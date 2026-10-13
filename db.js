window.DawaDB = (function () {
  // A single shared Supabase client for the static site. The app is intentionally
  // configured with a global `window.DAWA_SUPABASE_URL` and `window.DAWA_SUPABASE_ANON_KEY`.
  let client = null;
  const adminLoginError = "incorrect email or password, or this account isn't authorized";

  function getClient() {
    if (!window.supabase) {
      throw new Error('Supabase is not loaded. Ensure the CDN script is included before db.js.');
    }

    if (!window.DAWA_SUPABASE_URL || !window.DAWA_SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration is missing. Copy config.example.js to config.js and fill in your project values.');
    }

    if (!client) {
      client = window.supabase.createClient(window.DAWA_SUPABASE_URL, window.DAWA_SUPABASE_ANON_KEY);
    }

    return client;
  }

  function formatQuantity(quantity, unit) {
    const value = Number(quantity);
    if (!Number.isFinite(value)) {
      return String(quantity ?? '').trim();
    }
    const label = unit && unit.trim() ? unit.trim() : 'units';
    return `${value.toLocaleString('en-KE')} ${label}`;
  }

  function mapMedicineRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      drug: row.drug_name,
      quantity: row.quantity,
      quantityLabel: formatQuantity(row.quantity, row.unit),
      unit: row.unit || 'units',
      facility: row.facility_name,
      expiry: row.expiry_date,
      status: row.status,
      approval: row.approval,
      storage: row.storage_condition,
      contactPerson: row.contact_person,
      phone: row.phone,
      email: row.email,
      location: row.location,
      notes: row.notes,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }

  function mapTransferRequestRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      medicineId: row.medicine_id,
      drug: row.drug_name,
      supplierFacility: row.supplier_facility_name,
      facility: row.requesting_facility,
      deliveryLocation: row.delivery_location,
      contactPerson: row.contact_person,
      phone: row.phone,
      email: row.email,
      details: row.details,
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }

  function mapFacilityRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      county: row.county,
      contactPerson: row.contact_person,
      phone: row.phone,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  async function requireAdminSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) {
      throw new Error('Unable to verify the admin session.');
    }
    if (!data?.session) {
      throw new Error('Admin access is required.');
    }
    return data.session;
  }

  async function getApprovedMedicines() {
    const { data, error } = await getClient()
      .from('medicines')
      .select('*')
      .eq('approval', 'approved')
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Unable to load approved medicine listings: ${error.message}`);
    }

    return (data || []).map(mapMedicineRow);
  }

  async function getAllMedicines() {
    await requireAdminSession();
    const { data, error } = await getClient()
      .from('medicines')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Unable to load medicine listings: ${error.message}`);
    }

    return (data || []).map(mapMedicineRow);
  }

  async function addSurplusListing(payload) {
    const quantity = Number.parseInt(payload?.quantity, 10);
    const record = {
      drug_name: String(payload?.drug || '').trim(),
      quantity,
      unit: String(payload?.unit || 'units').trim() || 'units',
      facility_name: String(payload?.facility || '').trim(),
      expiry_date: payload?.expiry,
      status: 'monitor',
      approval: 'pending',
      storage_condition: payload?.storage || null,
      contact_person: payload?.contactPerson || null,
      phone: payload?.phone || null,
      email: payload?.email || null,
      location: payload?.location || null,
      notes: payload?.notes || null,
    };

    if (!record.drug_name || !record.facility_name || !record.expiry_date || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Please complete all required medicine details before submitting the listing.');
    }

    const { data, error } = await getClient()
      .from('medicines')
      .insert([record])
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to submit surplus listing: ${error.message}`);
    }

    return mapMedicineRow(data);
  }

  async function approveMedicine(id) {
    await requireAdminSession();
    const { data, error } = await getClient()
      .from('medicines')
      .update({ approval: 'approved' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to approve the medicine listing: ${error.message}`);
    }

    return mapMedicineRow(data);
  }

  async function rejectMedicine(id) {
    await requireAdminSession();
    const { data, error } = await getClient()
      .from('medicines')
      .update({ approval: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to reject the medicine listing: ${error.message}`);
    }

    return mapMedicineRow(data);
  }

  async function removeMedicine(id) {
    await requireAdminSession();
    const { error } = await getClient().from('medicines').delete().eq('id', id);
    if (error) {
      throw new Error(`Unable to remove the medicine listing: ${error.message}`);
    }
    return true;
  }

  async function adminAddMedicine(payload) {
    await requireAdminSession();
    const quantity = Number.parseInt(payload?.quantity, 10);
    const record = {
      drug_name: String(payload?.drug || '').trim(),
      quantity,
      unit: String(payload?.unit || 'units').trim() || 'units',
      facility_name: String(payload?.facility || '').trim(),
      expiry_date: payload?.expiry,
      status: payload?.status || 'monitor',
      approval: 'approved',
      storage_condition: payload?.storage || null,
      contact_person: payload?.contactPerson || null,
      phone: payload?.phone || null,
      email: payload?.email || null,
      location: payload?.location || null,
      notes: payload?.notes || null,
    };

    if (!record.drug_name || !record.facility_name || !record.expiry_date || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Please enter all required fields for the medicine listing.');
    }

    const { data, error } = await getClient()
      .from('medicines')
      .insert([record])
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to add the medicine listing: ${error.message}`);
    }

    return mapMedicineRow(data);
  }

  async function getFacilities() {
    const { data, error } = await getClient()
      .from('facilities')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Unable to load facilities: ${error.message}`);
    }

    return (data || []).map(mapFacilityRow);
  }

  async function addFacility(payload) {
    await requireAdminSession();
    const record = {
      name: String(payload?.name || '').trim(),
      county: String(payload?.county || '').trim() || null,
      contact_person: payload?.contactPerson || null,
      phone: payload?.phone || null,
      email: payload?.email || null,
    };

    if (!record.name) {
      throw new Error('The facility name is required.');
    }

    const { data, error } = await getClient()
      .from('facilities')
      .insert([record])
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to add the facility: ${error.message}`);
    }

    return mapFacilityRow(data);
  }

  async function removeFacility(id) {
    await requireAdminSession();
    const { error } = await getClient().from('facilities').delete().eq('id', id);
    if (error) {
      throw new Error(`Unable to remove the facility: ${error.message}`);
    }
    return true;
  }

  async function submitTransferRequest(payload) {
    const record = {
      medicine_id: payload?.medicine_id,
      drug_name: String(payload?.drug_name || payload?.drug || '').trim(),
      supplier_facility_name: String(payload?.supplier_facility_name || payload?.supplierFacility || '').trim(),
      requesting_facility: String(payload?.requesting_facility || payload?.facility || '').trim(),
      delivery_location: String(payload?.delivery_location || payload?.location || '').trim(),
      contact_person: String(payload?.contact_person || payload?.contactPerson || '').trim(),
      phone: String(payload?.phone || '').trim(),
      email: String(payload?.email || '').trim(),
      details: payload?.details || null,
    };

    const requiredFields = [
      record.medicine_id,
      record.drug_name,
      record.supplier_facility_name,
      record.requesting_facility,
      record.delivery_location,
      record.contact_person,
      record.phone,
      record.email,
    ];

    if (requiredFields.some((value) => !value)) {
      throw new Error('Please complete all required request fields.');
    }

    const { data, error } = await getClient()
      .from('transfer_requests')
      .insert([record])
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to submit the transfer request: ${error.message}`);
    }

    return mapTransferRequestRow(data);
  }

  async function getTransferRequests() {
    await requireAdminSession();
    const { data, error } = await getClient()
      .from('transfer_requests')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Unable to load transfer requests: ${error.message}`);
    }

    return (data || []).map(mapTransferRequestRow);
  }

  async function updateTransferRequestStatus(id, status) {
    await requireAdminSession();
    const allowed = ['new', 'contacted', 'resolved'];
    if (!allowed.includes(status)) {
      throw new Error('Invalid transfer request status.');
    }

    const { data, error } = await getClient()
      .from('transfer_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to update the transfer request: ${error.message}`);
    }

    return mapTransferRequestRow(data);
  }

  async function signInAdmin(email, password) {
    const trimmedEmail = String(email || '').trim();
    const trimmedPassword = String(password || '');
    if (!trimmedEmail || !trimmedPassword) {
      throw new Error(adminLoginError);
    }

    try {
      const { data, error } = await getClient().auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error || !data?.user?.id) {
        throw new Error(adminLoginError);
      }

      const { data: adminRecord, error: adminError } = await getClient()
        .from('admins')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (adminError || !adminRecord) {
        await getClient().auth.signOut();
        throw new Error(adminLoginError);
      }

      return data.session;
    } catch (error) {
      if (error?.message === adminLoginError) {
        throw error;
      }
      throw new Error(adminLoginError);
    }
  }

  async function signOutAdmin() {
    const { error } = await getClient().auth.signOut();
    if (error) {
      throw new Error(`Unable to sign out: ${error.message}`);
    }
    return true;
  }

  async function getAdminSession() {
    try {
      const { data, error } = await getClient().auth.getSession();
      if (error) {
        return null;
      }
      return data?.session || null;
    } catch (error) {
      return null;
    }
  }

  return {
    getApprovedMedicines,
    getAllMedicines,
    addSurplusListing,
    approveMedicine,
    rejectMedicine,
    removeMedicine,
    adminAddMedicine,
    getFacilities,
    addFacility,
    removeFacility,
    submitTransferRequest,
    getTransferRequests,
    updateTransferRequestStatus,
    signInAdmin,
    signOutAdmin,
    getAdminSession,
  };
})();
