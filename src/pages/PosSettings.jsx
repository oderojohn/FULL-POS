import React from 'react'
import { FaBell, FaCreditCard, FaPercent, FaReceipt, FaSave, FaShieldAlt } from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'

const Settings = () => {
  const { company, branch } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure tax, receipts, payments, discounts, loyalty, notifications, and security controls.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 divide-y divide-slate-200">
        <section className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaReceipt className="text-emerald-600 text-xl" />
            <h2 className="text-lg font-semibold text-slate-900">Company & Receipt Identity</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Name" defaultValue={company?.name || ''} />
            <Field label="Default Currency" defaultValue={company?.currency || 'KES'} />
            <Field label="Active Branch" defaultValue={branch?.name || ''} />
            <Field label="Invoice Prefix" defaultValue="RC" />
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaPercent className="text-emerald-600 text-xl" />
            <h2 className="text-lg font-semibold text-slate-900">Tax & Discount Rules</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="VAT Rate" defaultValue={`${company?.vat_rate ?? 16}%`} />
            <Field label="Service Charge" defaultValue="0%" />
            <Field label="Manager Approval Above" defaultValue="10% discount" />
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaCreditCard className="text-emerald-600 text-xl" />
            <h2 className="text-lg font-semibold text-slate-900">Payment Methods</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {['Cash', 'M-Pesa', 'Card', 'Credit Sale'].map((method) => (
              <label key={method} className="flex items-center px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                <input type="checkbox" defaultChecked className="mr-2" />
                <span className="text-sm font-medium">{method}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaBell className="text-emerald-600 text-xl" />
            <h2 className="text-lg font-semibold text-slate-900">Alerts & Notifications</h2>
          </div>
          <div className="space-y-3">
            {['Low stock alerts', 'Expiry alerts', 'Refund approval alerts', 'Daily cash summary email'].map((setting) => (
              <label key={setting} className="flex items-center">
                <input type="checkbox" defaultChecked className="mr-2" />
                <span className="text-sm text-slate-700">{setting}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaShieldAlt className="text-emerald-600 text-xl" />
            <h2 className="text-lg font-semibold text-slate-900">Security & Approval Controls</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['Require approval for refunds', 'Lock closed shifts', 'Block product deletion with transactions'].map((setting) => (
              <label key={setting} className="flex items-center px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                <input type="checkbox" defaultChecked className="mr-2" />
                <span className="text-sm font-medium">{setting}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="p-6">
          <button className="inline-flex items-center px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            <FaSave className="mr-2" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

const Field = ({ label, defaultValue }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <input type="text" defaultValue={defaultValue} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
  </div>
)

export default Settings
