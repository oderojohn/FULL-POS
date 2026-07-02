const DEVICE_ID_KEY = 'nexa-device-id'

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = generateUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'fallback-device'
  }
}

// First 8 hex chars of the UUID, uppercase — used in receipt prefixes
export function getDeviceShortCode() {
  return getDeviceId().replace(/-/g, '').slice(0, 8).toUpperCase()
}
