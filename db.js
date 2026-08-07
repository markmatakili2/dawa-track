window.DawaDB = (function () {
    const STORAGE_KEY = 'dawatrack-db';
    const seed = {
        facilities: [
            { id: 'kenyatta', name: 'Kenyatta National Hospital', county: 'Nairobi', contactPerson: 'Pharmacy Lead', phone: '0711000001', email: 'contact@kenyatta.go.ke' },
            { id: 'machakos', name: 'Machakos Level 5', county: 'Machakos', contactPerson: 'Supply Officer', phone: '0711000002', email: 'contact@machakos.go.ke' },
            { id: 'kemsa', name: 'KEMSA Central Warehouse', county: 'Nairobi', contactPerson: 'Warehouse Manager', phone: '0711000003', email: 'contact@kemsa.go.ke' },
        ],
        medicines: [
            { id: 'm1', drug: 'Amoxicillin 500mg', quantity: '4,000 units', facility: 'Kenyatta National Hospital', expiry: '3 days', status: 'ready', approval: 'approved' },
            { id: 'm2', drug: 'Paracetamol Infusion', quantity: '2,500 units', facility: 'Machakos Level 5', expiry: '9 days', status: 'ready', approval: 'approved' },
            { id: 'm3', drug: 'ORS Sachets', quantity: '10,000 units', facility: 'Machakos Level 5', expiry: '60 days', status: 'monitor', approval: 'approved' },
            { id: 'm4', drug: 'IV Normal Saline', quantity: '15,000 units', facility: 'KEMSA Central Warehouse', expiry: '21 days', status: 'ready', approval: 'approved' },
        ],
        transferRequests: [],
    };

    function nowStamp() {
        return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function uid(prefix) {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    function load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            const copy = JSON.parse(JSON.stringify(seed));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
            return copy;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.facilities) && Array.isArray(parsed.medicines) && Array.isArray(parsed.transferRequests)) {
                return parsed;
            }
        } catch (error) {
            console.warn('DawaDB parse error:', error);
        }
        const copy = JSON.parse(JSON.stringify(seed));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
        return copy;
    }

    function save(db) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        return db;
    }

    function reset() {
        localStorage.removeItem(STORAGE_KEY);
        return load();
    }

    return { load, save, uid, nowStamp, reset };
})();
