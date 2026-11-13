import React, { useState, useEffect, useMemo } from 'react';
import { Customer, BookOrder } from '../types';
import { 
  Users, Search, Phone, MapPin, ShoppingBag, Calendar, ExternalLink, MessageSquare, 
  Tag, ShieldCheck, Bookmark, Check, Edit3, X, Award, ChevronRight, Clock, Package
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';

interface CustomerManagerProps {
  customers: Customer[];
  onRefresh?: () => void;
}

const PRESET_LABELS = [
  { label: 'VIP', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  { label: 'School', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  { label: 'Unity', color: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  { label: 'Wholesale', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  { label: 'Regular', color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' }
];

export default function CustomerManager({ customers, onRefresh }: CustomerManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [labelFilter, setLabelFilter] = useState<'All' | 'VIP' | 'School' | 'Unity' | 'Unlabeled'>('All');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Selected customer for full Details Drawer / Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Label Edit State
  const [editingLabelCustomer, setEditingLabelCustomer] = useState<Customer | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');
  const [customInputLabel, setCustomInputLabel] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [savingLabel, setSavingLabel] = useState(false);

  // Filter logic
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.customLabel && c.customLabel.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (labelFilter === 'All') return true;
      if (labelFilter === 'Unlabeled') return !c.customLabel;
      return c.customLabel?.toLowerCase() === labelFilter.toLowerCase();
    });
  }, [customers, searchTerm, labelFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, labelFilter]);

  const totalSpentAll = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

  // Open Full Details (Fetch complete order history from API if needed)
  const handleOpenDetails = async (c: Customer) => {
    setSelectedCustomer(c);
    setLoadingDetails(true);
    try {
      const res = await ApiClient.getCustomerDetails(c.phone);
      if (res && res.success && res.customer) {
        setSelectedCustomer(res.customer);
      }
    } catch (e) {
      console.warn('Could not fetch extra customer details, using local state:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Edit Label Modal
  const handleOpenEditLabel = (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLabelCustomer(c);
    setActiveLabel(c.customLabel || '');
    setCustomInputLabel(c.customLabel && !PRESET_LABELS.some(p => p.label === c.customLabel) ? c.customLabel : '');
    setAdminNotes(c.adminNotes || '');
  };

  // Save Label to Backend API
  const handleSaveLabel = async () => {
    if (!editingLabelCustomer) return;
    const finalLabel = customInputLabel.trim() || activeLabel;
    setSavingLabel(true);
    try {
      await ApiClient.updateCustomerLabel({
        phone: editingLabelCustomer.phone,
        label: finalLabel,
        notes: adminNotes
      });

      // Update in memory customer list
      editingLabelCustomer.customLabel = finalLabel;
      editingLabelCustomer.adminNotes = adminNotes;
      if (selectedCustomer && selectedCustomer.phone === editingLabelCustomer.phone) {
        setSelectedCustomer({
          ...selectedCustomer,
          customLabel: finalLabel,
          adminNotes
        });
      }
      setEditingLabelCustomer(null);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to update customer label');
    } finally {
      setSavingLabel(false);
    }
  };

  const getLabelBadge = (label?: string) => {
    if (!label) return null;
    const matched = PRESET_LABELS.find(p => p.label.toLowerCase() === label.toLowerCase());
    const badgeStyle = matched ? matched.color : 'bg-indigo-100 text-indigo-800 border-indigo-300';
    const dotStyle = matched ? matched.dot : 'bg-indigo-500';

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${badgeStyle} shadow-2xs`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">মোট কাস্টমার (Total Customers)</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {customers.length.toLocaleString('en-US')}
            </h3>
          </div>
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-600">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">মোট বিক্রয় (Total Revenue)</p>
            <h3 className="text-2xl font-extrabold text-teal-700 mt-1">
              Tk. {totalSpentAll.toLocaleString('en-US')}
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">এভারেজ অর্ডার সাইজ (AOV)</p>
            <h3 className="text-2xl font-extrabold text-blue-700 mt-1">
              Tk. {(customers.length ? Math.round(totalSpentAll / customers.length) : 0).toLocaleString('en-US')}
            </h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
            <Calendar className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              Customer Directory with Custom Labels
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              কাস্টমার লিস্টে ক্লিক করে পূর্ববর্তী অর্ডারের বিস্তারিত দেখুন এবং VIP, School, Unity বা কাস্টম ট্যাগ লাগান
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Tag Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['All', 'VIP', 'School', 'Unity', 'Unlabeled'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLabelFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    labelFilter === tab
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'All' ? 'All' : tab === 'Unlabeled' ? 'No Label' : tab}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, phone, address, label..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Customer Name & Label</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-center">Total Orders</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4 text-center">Last Order</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedCustomers.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => handleOpenDetails(c)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Name & Custom Label */}
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="group-hover:text-teal-600 transition-colors text-sm">{c.name}</span>
                      {c.customLabel ? (
                        getLabelBadge(c.customLabel)
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditLabel(c, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 hover:text-teal-600 inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full"
                          title="Add Label"
                        >
                          <Tag className="w-3 h-3" />
                          <span>Add label</span>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="py-3.5 px-4 font-mono text-slate-800">
                    <div className="flex items-center space-x-1.5">
                      <Phone className="h-3.5 w-3.5 text-teal-600" />
                      <span>{c.phone}</span>
                    </div>
                  </td>

                  {/* Address */}
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{c.address || 'No address provided'}</span>
                    </div>
                  </td>

                  {/* Total Orders */}
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                    <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full text-[11px]">
                      {c.totalOrders || (c.orders ? c.orders.length : 1)} {((c.totalOrders || 1) === 1 ? 'Order' : 'Orders')}
                    </span>
                  </td>

                  {/* Total Spent */}
                  <td className="py-3.5 px-4 text-right font-extrabold text-teal-800">
                    Tk. {(c.totalSpent || 0).toLocaleString('en-US')}
                  </td>

                  {/* Last Order Date */}
                  <td className="py-3.5 px-4 text-center text-slate-500">
                    {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleOpenEditLabel(c)}
                        className="p-1.5 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Edit Customer Label (VIP, School, Unity)"
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDetails(c)}
                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="View Full History"
                      >
                        <span>Details</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      <a
                        href={`https://wa.me/88${c.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                        title="Send message on WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No customer records found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCustomers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl select-none">
            <div className="text-xs text-slate-600 font-medium">
              Showing{' '}
              <span className="font-bold text-slate-900">
                {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredCustomers.length)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{filteredCustomers.length}</span> customers
              <span className="text-slate-300 mx-2">•</span>
              <span className="font-semibold text-emerald-700">Page {currentPage} of {totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs active:scale-95"
                title="Previous Page"
              >
                ←
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs ${
                      isActive
                        ? 'bg-slate-900 text-white border border-slate-900 shadow-xs scale-105'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs active:scale-95"
                title="Next Page"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1. CUSTOMER FULL DETAILS MODAL / DRAWER */}
      {/* ============================================================== */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-extrabold text-slate-900 text-xl">{selectedCustomer.name}</h3>
                  {selectedCustomer.customLabel && getLabelBadge(selectedCustomer.customLabel)}
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mt-1">
                  <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    {selectedCustomer.phone}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCustomer.address || 'Address not set'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditLabel(selectedCustomer)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5 text-teal-600" />
                  <span>{selectedCustomer.customLabel ? 'Change Label' : 'Add Label'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Orders</span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                  {selectedCustomer.orders ? selectedCustomer.orders.length : selectedCustomer.totalOrders || 1}
                </span>
              </div>
              <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-200/80">
                <span className="text-[10px] uppercase font-bold text-teal-600 block tracking-wider">Total Spent</span>
                <span className="text-xl font-extrabold text-teal-800 mt-0.5 block">
                  Tk. {(selectedCustomer.totalSpent || 0).toLocaleString('en-US')}
                </span>
              </div>
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200/80">
                <span className="text-[10px] uppercase font-bold text-purple-600 block tracking-wider">Category Tag</span>
                <span className="text-sm font-black text-purple-800 mt-1 block">
                  {selectedCustomer.customLabel || 'Regular Customer'}
                </span>
              </div>
            </div>

            {/* Admin Notes if present */}
            {selectedCustomer.adminNotes && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-amber-900">
                <span className="font-bold block mb-0.5">📌 Admin Private Note:</span>
                <p className="font-medium">{selectedCustomer.adminNotes}</p>
              </div>
            )}

            {/* Past Orders History List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span>Past Orders History ({selectedCustomer.orders ? selectedCustomer.orders.length : 0})</span>
                </h4>
                {loadingDetails && (
                  <span className="text-xs text-slate-400 animate-pulse">Loading orders...</span>
                )}
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {(selectedCustomer.orders || []).map((ord: any) => (
                  <div 
                    key={ord.id} 
                    className="bg-slate-50 hover:bg-slate-100/70 p-4 rounded-2xl border border-slate-200/80 text-xs transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 font-mono text-sm">{ord.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                          ord.status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                          ord.status === 'Confirmed' ? 'bg-teal-100 text-teal-800' : 
                          ord.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {ord.status}
                        </span>
                        {ord.courierProvider && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            {ord.courierProvider}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-800 text-xs">
                        {ord.productTitle || (ord.items && ord.items.map((i: any) => i.productTitle || i.product?.title).join(', ')) || 'Savaria BD Product'}
                      </div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(ord.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>Qty: {ord.quantity || 1}</span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-black text-slate-900 text-sm sm:text-base">
                        Tk. {(ord.totalPrice || ord.totalAmount || 0).toLocaleString('en-US')}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Payment: {ord.paymentMethod || 'COD'}
                      </span>
                    </div>
                  </div>
                ))}

                {(!selectedCustomer.orders || selectedCustomer.orders.length === 0) && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No past orders found for this customer phone
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CUSTOM LABEL / TAG ASSIGN MODAL */}
      {/* ============================================================== */}
      {editingLabelCustomer && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-teal-600" />
                  <span>Assign Customer Label</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingLabelCustomer.name} ({editingLabelCustomer.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLabelCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preset Label Choices */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Select Predefined Label
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_LABELS.map(preset => {
                  const isSelected = activeLabel === preset.label && !customInputLabel;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setActiveLabel(preset.label);
                        setCustomInputLabel('');
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? `${preset.color} ring-2 ring-teal-500 shadow-xs`
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${preset.dot}`} />
                      <span>{preset.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Label Input */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Or Custom Label Name
              </label>
              <input
                type="text"
                placeholder="e.g. VIP, School, Unity, Corporate..."
                value={customInputLabel}
                onChange={(e) => {
                  setCustomInputLabel(e.target.value);
                  setActiveLabel(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Admin Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Admin Private Notes (ঐচ্ছিক নোট)
              </label>
              <textarea
                rows={3}
                placeholder="Write private notes about this customer (e.g. payment reliable, bulk buyer, teacher)..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {editingLabelCustomer.customLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveLabel('');
                    setCustomInputLabel('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                >
                  Remove Label
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLabelCustomer(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLabel}
                  disabled={savingLabel}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingLabel ? 'Saving...' : 'Save Label'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
