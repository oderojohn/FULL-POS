import React, { useEffect, useState } from 'react'
import { FaPrint, FaCog, FaDesktop, FaPlug, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'

const LS_KEY = 'nexa-device-settings'

const defaults = {
  terminalName: '',
  printerName: '',
  printMode: 'silent',
  cashDrawerPort: '',
  showPrintDialog: false,
}

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }
  } catch {
    return { ...defaults }
  }
}

function saveSettings(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

const COM_PORTS = ['', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'USB001']

export default function DeviceSettings() {
  const [settings, setSettings] = useState(loadSettings)
  const [printers, setPrinters] = useState([])
  const [version, setVersion] = useState('')
  const [userData, setUserData] = useState('')
  const [testMsg, setTestMsg] = useState(null)
  const [drawerMsg, setDrawerMsg] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load Electron-provided values
    if (window.electronAPI) {
      window.electronAPI.getVersion?.().then(v => setVersion(v)).catch(() => {})
      window.electronAPI.getUserDataPath?.().then(p => setUserData(p)).catch(() => {})
      window.electronAPI.getPrinters?.().then(list => {
        setPrinters(list?.map(p => p.name || p) || [])
      }).catch(() => {})
    }
  }, [])

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestPrint = async () => {
    setTestMsg(null)
    try {
      if (window.electronAPI?.printReceipt) {
        await window.electronAPI.printReceipt({
          printerName: settings.printerName,
          silent: settings.printMode === 'silent',
          test: true,
        })
        setTestMsg({ type: 'success', text: 'Test receipt sent to printer.' })
      } else {
        window.print()
        setTestMsg({ type: 'success', text: 'Print dialog opened (browser mode).' })
      }
    } catch (err) {
      setTestMsg({ type: 'error', text: `Print failed: ${err.message}` })
    }
  }

  const handleTestDrawer = async () => {
    setDrawerMsg(null)
    try {
      if (window.electronAPI?.openCashDrawer) {
        await window.electronAPI.openCashDrawer({ port: settings.cashDrawerPort })
        setDrawerMsg({ type: 'success', text: 'Cash drawer command sent.' })
      } else {
        setDrawerMsg({ type: 'error', text: 'Cash drawer IPC not available (requires packaged Electron app).' })
      }
    } catch (err) {
      setDrawerMsg({ type: 'error', text: `Drawer failed: ${err.message}` })
    }
  }

  const Field = ({ label, help, children }) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      {children}
      {help && <p className="text-xs text-slate-400 mt-1">{help}</p>}
    </div>
  )

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <FaCog className="text-slate-400" />
          <h1 className="text-lg font-bold text-slate-800">Device Settings</h1>
          <span className="ml-auto text-xs text-slate-400">Settings are stored locally on this device only</span>
        </div>

        {/* Terminal identity */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FaDesktop className="text-slate-400 text-sm" />
            <h2 className="text-sm font-bold text-slate-800">Terminal Identity</h2>
          </div>
          <Field label="Terminal Name" help="Displayed on receipts and in audit logs. E.g. 'Till 1' or 'Counter A'.">
            <input
              type="text"
              value={settings.terminalName}
              onChange={e => update('terminalName', e.target.value)}
              placeholder="Till 1"
              className={inputCls}
            />
          </Field>
          {version && (
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
              <span>App version: <strong className="text-slate-700">{version}</strong></span>
              {userData && <span className="truncate">Data: <strong className="text-slate-700">{userData}</strong></span>}
            </div>
          )}
        </section>

        {/* Receipt printer */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FaPrint className="text-slate-400 text-sm" />
            <h2 className="text-sm font-bold text-slate-800">Receipt Printer</h2>
          </div>
          <Field label="Printer" help="Select the receipt printer installed on this computer.">
            {printers.length > 0 ? (
              <select value={settings.printerName} onChange={e => update('printerName', e.target.value)} className={inputCls}>
                <option value="">— Use default printer —</option>
                {printers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={settings.printerName}
                onChange={e => update('printerName', e.target.value)}
                placeholder="Printer name (e.g. EPSON TM-T82)"
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Print Mode">
            <div className="flex gap-3">
              {[
                { value: 'silent', label: 'Silent (no dialog)' },
                { value: 'dialog', label: 'Show print dialog' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="printMode"
                    value={opt.value}
                    checked={settings.printMode === opt.value}
                    onChange={() => update('printMode', opt.value)}
                    className="accent-emerald-600"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FaPrint className="text-[10px]" /> Test Print
            </button>
            {testMsg && (
              <span className={`text-xs font-medium flex items-center gap-1 ${testMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {testMsg.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                {testMsg.text}
              </span>
            )}
          </div>
        </section>

        {/* Cash drawer */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FaPlug className="text-slate-400 text-sm" />
            <h2 className="text-sm font-bold text-slate-800">Cash Drawer</h2>
          </div>
          <Field
            label="COM Port"
            help="Most cash drawers connect through the receipt printer. Select the printer port (e.g. COM3) or leave blank to disable."
          >
            <select value={settings.cashDrawerPort} onChange={e => update('cashDrawerPort', e.target.value)} className={inputCls}>
              {COM_PORTS.map(p => <option key={p} value={p}>{p || '— Disabled —'}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestDrawer}
              disabled={!settings.cashDrawerPort}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <FaPlug className="text-[10px]" /> Test Drawer
            </button>
            {drawerMsg && (
              <span className={`text-xs font-medium flex items-center gap-1 ${drawerMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {drawerMsg.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                {drawerMsg.text}
              </span>
            )}
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            {saved ? <><FaCheckCircle /> Saved!</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
