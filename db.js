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
        transferRequests: [
            {
                id: 'req-1',
                drug: 'Amoxicillin 500mg',
                supplierFacility: 'Kenyatta National Hospital',
                facility: 'Makueni County Hospital',
                deliveryLocation: 'Pharmacy ward',
                contactPerson: 'Esther N.',
                phone: '0712345678',
                email: 'esther.n@example.org',
                details: 'Need 1,000 units urgently for pediatric ward',
                status: 'new',
                timestamp: '12 Aug 2026, 09:15',
            },
            {
                id: 'req-2',
                drug: 'Paracetamol Infusion',
                supplierFacility: 'Machakos Level 5',
                facility: 'Kitui County Referral Hospital',
                deliveryLocation: 'Emergency triage',
                contactPerson: 'Daniel K.',
                phone: '0722345678',
                email: 'daniel.k@example.org',
                details: 'Requesting 500 units for fever cases this week',
                status: 'contacted',
                timestamp: '11 Aug 2026, 14:40',
            },
            {
                id: 'req-3',
                drug: 'ORS Sachets',
                supplierFacility: 'Machakos Level 5',
                facility: 'Nairobi Women’s Hospital',
                deliveryLocation: 'Outpatient department',
                contactPerson: 'Peter O.',
                phone: '0733456789',
                email: 'peter.o@example.org',
                details: 'Follow up supply for dehydration cases',
                status: 'new',
                timestamp: '10 Aug 2026, 08:30',
            },
        ],
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
                if (!parsed._mockSeedApplied && parsed.transferRequests.length === 0) {
                    parsed.transferRequests = JSON.parse(JSON.stringify(seed.transferRequests));
                    parsed._mockSeedApplied = true;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                }
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
