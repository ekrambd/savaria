import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Home, 
  Briefcase, 
  Building2, 
  Check, 
  Plus, 
  ChevronRight, 
  Loader2,
  Trash2,
  Edit2
} from 'lucide-react';
import { CustomerAddress } from '../types';
import { getCustomerSession, setCustomerSession } from '../lib/customerAuth';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAddress: CustomerAddress | null;
  onSelectAddress: (addr: CustomerAddress) => void;
}

export default function AddressModal({
  isOpen,
  onClose,
  selectedAddress,
  onSelectAddress
}: AddressModalProps) {
  const [session, setSession] = useState(getCustomerSession());
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingAddr, setEditingAddr] = useState<CustomerAddress | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [addressType, setAddressType] = useState<'Home' | 'Office' | 'Hometown'>('Home');
  const [makeDefault, setMakeDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pathao / Dynamic Area State
  const [cities, setCities] = useState<{ city_id: number; city_name: string }[]>([]);
  const [zones, setZones] = useState<{ zone_id: number; zone_name: string }[]>([]);
  const [areas, setAreas] = useState<{ area_id: number; area_name: string }[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaCascade, setShowAreaCascade] = useState(false);

  // Sync session
  useEffect(() => {
    const handleAuth = () => setSession(getCustomerSession());
    window.addEventListener('customer-auth-changed', handleAuth);
    return () => window.removeEventListener('customer-auth-changed', handleAuth);
  }, []);

  // Fetch addresses whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const currentSession = getCustomerSession();
    setSession(currentSession);

    // Load from local storage first for zero-latency
    const localSaved = localStorage.getItem('customer_saved_addresses');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAddresses(parsed);
          if (!selectedAddress) onSelectAddress(parsed[0]);
        }
      } catch {}
    }

    if (currentSession?.phone) {
      setLoading(true);
      fetch(`/api/customers/address/by-phone?phone=${encodeURIComponent(currentSession.phone)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.addresses) && data.addresses.length > 0) {
            setAddresses(data.addresses);
            localStorage.setItem('customer_saved_addresses', JSON.stringify(data.addresses));
            const def = data.addresses.find((a: any) => a.isDefault) || data.addresses[0];
            if (def && !selectedAddress) {
              onSelectAddress(def);
            }
          }
        })
        .catch(err => console.warn('Error loading customer addresses:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Load Pathao / Courier Cities for cascade
  useEffect(() => {
    if (!isAddingNew) return;
    fetch('/api/courier/pathao/cities')
      .then(res => res.json())
      .then(data => {
        const list = data?.data?.data || data?.data || data || [];
        if (Array.isArray(list)) setCities(list);
      })
      .catch(() => {});
  }, [isAddingNew]);

  // Load Zones when City changes
  useEffect(() => {
    if (!selectedCity) {
      setZones([]);
      setSelectedZone('');
      return;
    }
    fetch(`/api/courier/pathao/cities/${selectedCity}/zones`)
      .then(res => res.json())
      .then(data => {
        const list = data?.data?.data || data?.data || data || [];
        if (Array.isArray(list)) setZones(list);
      })
      .catch(() => {});
  }, [selectedCity]);

  // Load Areas when Zone changes
  useEffect(() => {
    if (!selectedZone) {
      setAreas([]);
      setSelectedArea('');
      return;
    }
    fetch(`/api/courier/pathao/zones/${selectedZone}/areas`)
      .then(res => res.json())
      .then(data => {
        const list = data?.data?.data || data?.data || data || [];
        if (Array.isArray(list)) setAreas(list);
      })
      .catch(() => {});
  }, [selectedZone]);

  // Handle open add / edit form
  const handleOpenAddForm = (existing?: CustomerAddress) => {
    if (existing) {
      setEditingAddr(existing);
      setFullName(existing.name);
      setPhoneNumber(existing.phone);
      setAddressLine(existing.address);
      setDeliveryArea(existing.deliveryArea);
      setAddressType(existing.addressType || 'Home');
      setMakeDefault(Boolean(existing.isDefault));
    } else {
      setEditingAddr(null);
      setFullName(session?.name || '');
      setPhoneNumber(session?.phone ? `+88${session.phone}` : '+880');
      setAddressLine('');
      setDeliveryArea('');
      setAddressType('Home');
      setMakeDefault(addresses.length === 0);
    }
    setIsAddingNew(true);
  };

  // Construct Area string from cascade
  const handleApplyCascadeArea = () => {
    const cObj = cities.find(c => String(c.city_id) === String(selectedCity));
    const zObj = zones.find(z => String(z.zone_id) === String(selectedZone));
    const aObj = areas.find(a => String(a.area_id) === String(selectedArea));

    const parts = [cObj?.city_name, zObj?.zone_name, aObj?.area_name].filter(Boolean);
    if (parts.length > 0) {
      setDeliveryArea(parts.join(' > '));
    }
    setShowAreaCascade(false);
  };

  // Submit Address Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim() || !addressLine.trim()) return;

    setIsSubmitting(true);
    const cleanPhone = phoneNumber.replace(/\D/g, '').replace(/^880/, '0').replace(/^88/, '');
    const addrId = editingAddr ? editingAddr.id : `addr-${Date.now()}`;

    const newAddr: CustomerAddress = {
      id: addrId,
      name: fullName.trim(),
      phone: phoneNumber.trim(),
      address: addressLine.trim(),
      deliveryArea: deliveryArea.trim() || 'Dhaka',
      addressType,
      isDefault: makeDefault
    };

    // Update state & local storage immediately
    let updated = [...addresses];
    if (makeDefault) {
      updated = updated.map(a => ({ ...a, isDefault: false }));
    }
    const idx = updated.findIndex(a => a.id === addrId);
    if (idx >= 0) {
      updated[idx] = newAddr;
    } else {
      updated.push(newAddr);
    }

    setAddresses(updated);
    localStorage.setItem('customer_saved_addresses', JSON.stringify(updated));
    onSelectAddress(newAddr);

    // Save session phone if not logged in
    if (!session) {
      setCustomerSession({ phone: cleanPhone, name: fullName.trim() });
    }

    // Persist to Backend API
    try {
      await fetch('/api/customers/address/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          addressItem: newAddr
        })
      });
    } catch (err) {
      console.warn('Failed to sync address to backend:', err);
    } finally {
      setIsSubmitting(false);
      setIsAddingNew(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Arogga Design */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {isAddingNew 
              ? (editingAddr ? 'Update Shipping Address' : 'Add Shipping Address') 
              : 'Address'}
          </h2>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {!isAddingNew ? (
            /* ADDRESS LIST VIEW */
            <div className="space-y-4">
              {addresses.length === 0 && !loading && (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No saved address yet</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Add your delivery address to see live delivery estimates and enjoy 1-click checkout.
                  </p>
                </div>
              )}

              {addresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <div 
                    key={addr.id}
                    onClick={() => {
                      onSelectAddress(addr);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex items-start gap-3.5 ${
                      isSelected 
                        ? 'border-teal-600 bg-teal-50/20 shadow-xs ring-1 ring-teal-600/30' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Icon based on addressType */}
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {addr.addressType === 'Office' ? (
                        <Briefcase className="w-5 h-5" />
                      ) : addr.addressType === 'Hometown' ? (
                        <Building2 className="w-5 h-5" />
                      ) : (
                        <Home className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">
                          {addr.addressType} Address
                        </span>
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full">
                          (Shipping Address)
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-1">
                        {addr.name}
                      </h4>
                      <p className="text-xs font-mono text-slate-600 mt-0.5">
                        {addr.phone}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {addr.address}{addr.deliveryArea ? `, ${addr.deliveryArea}` : ''}
                      </p>
                    </div>

                    {/* Radio Indicator */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-teal-700 bg-teal-700' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddForm(addr);
                      }}
                      className="absolute right-4 top-3 text-slate-400 hover:text-slate-700 p-1"
                      title="Edit address"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => handleOpenAddForm()}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 mt-4"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Address</span>
              </button>
            </div>
          ) : (
            /* ADD / UPDATE FORM VIEW matching Screenshot 1 & 3 */
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rakibul"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="+8801315861003"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                />
              </div>

              {/* Select Delivery Area */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Select Delivery Area <span className="text-rose-500">*</span>
                </label>
                <div 
                  onClick={() => setShowAreaCascade(!showAreaCascade)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-300"
                >
                  <span className={deliveryArea ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    {deliveryArea || 'Select delivery area'}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showAreaCascade ? 'rotate-90' : ''}`} />
                </div>

                {/* Cascade Selector */}
                {showAreaCascade && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">Select City/Division</option>
                        {cities.map((c) => (
                          <option key={c.city_id} value={c.city_id}>{c.city_name}</option>
                        ))}
                      </select>

                      <select
                        disabled={!selectedCity}
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs disabled:opacity-50"
                      >
                        <option value="">Select District/Zone</option>
                        {zones.map((z) => (
                          <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>
                        ))}
                      </select>

                      <select
                        disabled={!selectedZone}
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs disabled:opacity-50"
                      >
                        <option value="">Select Thana/Area</option>
                        {areas.map((a) => (
                          <option key={a.area_id} value={a.area_id}>{a.area_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAreaCascade(false)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!selectedCity}
                        onClick={handleApplyCascadeArea}
                        className="px-4 py-1 bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                      >
                        Apply Area
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Address (House, Flat, Road, Landmark) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Type House, Flat No, Road"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                />
              </div>

              {/* Address Type Toggle (Home, Office, Hometown) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Address Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Home', label: 'Home', icon: Home },
                    { id: 'Office', label: 'Office', icon: Briefcase },
                    { id: 'Hometown', label: 'Hometown', icon: Building2 }
                  ].map((item) => {
                    const IconComp = item.icon;
                    const isActive = addressType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAddressType(item.id as any)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isActive 
                            ? 'bg-teal-700 text-white border-teal-700 shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Make default address Switch */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-700">Make default address</span>
                <button
                  type="button"
                  onClick={() => setMakeDefault(!makeDefault)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    makeDefault ? 'bg-teal-700' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    makeDefault ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="pt-3 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Back to Saved Addresses
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}