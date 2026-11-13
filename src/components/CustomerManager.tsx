import React, { useState, useEffect, useMemo } from 'react';
import { Customer, BookOrder } from '../types';
import { Users, Search, Phone, MapPin, ShoppingBag, Calendar, ExternalLink, MessageSquare } from 'lucide-react';

interface CustomerManagerProps {
  customers: Customer[];
}

export default function CustomerManager({ customers }: CustomerManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Customers</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {customers.length.toLocaleString('en-US')} {customers.length === 1 ? 'Customer' : 'Customers'}
            </h3>
          </div>
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-600">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Sales Revenue</p>
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
            <p className="text-xs text-slate-500 font-medium">Average Order Value</p>
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
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              Customer Directory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically collected customer profiles from completed and pending orders
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or mobile number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
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
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {c.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-800">
                    <div className="flex items-center space-x-1.5">
                      <Phone className="h-3.5 w-3.5 text-teal-600" />
                      <span>{c.phone}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{c.address || 'No address provided'}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                    <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full text-[11px]">
                      {c.totalOrders} {c.totalOrders === 1 ? 'Order' : 'Orders'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-teal-800">
                    Tk. {c.totalSpent.toLocaleString('en-US')}
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-500">
                    {new Date(c.lastOrderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="p-1.5 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="View order history"
                      >
                        Details
                      </button>
                      <a
                        href={`https://wa.me/88${c.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
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
                    No customer records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (1-15 per page, modern box-card UI) */}
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
                aria-label="Previous Page"
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
                        ? 'bg-[#16a34a] text-white border border-[#16a34a] shadow-xs scale-105'
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
                aria-label="Next Page"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-500 flex items-center space-x-3 mt-1">
                  <span>Phone: {selectedCustomer.phone}</span>
                  <span>•</span>
                  <span>Total Spent: Tk. {selectedCustomer.totalSpent.toLocaleString('en-US')}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs">
                Order History ({selectedCustomer.orders.length} {selectedCustomer.orders.length === 1 ? 'Order' : 'Orders'})
              </h4>
              <div className="space-y-2">
                {selectedCustomer.orders.map((ord) => (
                  <div key={ord.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{ord.id} - {ord.productTitle}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Date: {new Date(ord.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} • Quantity: {ord.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-teal-800">Tk. {ord.totalPrice.toLocaleString('en-US')}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                        ord.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                        ord.status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                        ord.status === 'Confirmed' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
