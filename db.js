window.DawaDB = (function () {
  let client = null;

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
    const label = unit && unit.trim() ? unit.trim() : 'units';
    return Number.isFinite(value) ? `${value.toLocaleString('en-KE')} ${label}` : String(quantity ?? '').trim();
  }

  function mapMedicineRow(row) {
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
      listedBy: row.listed_by,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }

  function mapTransferRequestRow(row) {
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
      requestedBy: row.requested_by,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }

  function mapFacilityProfile(row) {
    return {
      userId: row.user_id,
      facilityName: row.facility_name,
      facilityType: row.facility_type,
      county: row.county,
      address: row.address,
      licenceNumber: row.licence_number,
      contactPerson: row.contact_person,
      contactRole: row.contact_role,
      phone: row.phone,
      email: row.email,
      verificationStatus: row.verification_status,
      verificationNotes: row.verification_notes,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw new Error('Unable to verify the current session.');
    return data?.session || null;
  }

  async function getRole() {
    const session = await getSession();
    if (!session) return null;

    const { data, error } = await getClient().rpc('is_admin');
    if (error) throw new Error('Unable to verify account permissions.');
    return data === true ? 'admin' : 'facility';
  }

  async function requireAdmin() {
    if (await getRole() !== 'admin') {
      throw new Error('Admin access is required.');
    }
  }

  async function signUpFacility(form, captchaToken) {
    if (!captchaToken) throw new Error('Please complete the verification.');
    const record = {
      facility_name: String(form?.facility_name || '').trim(),
      facility_type: String(form?.facility_type || 'other').trim(),
      county: String(form?.county || '').trim(),
      address: String(form?.address || '').trim(),
      licence_number: String(form?.licence_number || '').trim(),
      contact_person: String(form?.contact_person || '').trim(),
      contact_role: String(form?.contact_role || '').trim(),
      phone: String(form?.phone || '').trim(),
      email: String(form?.email || '').trim(),
      password: String(form?.password || ''),
    };

    try {
      const { data, error } = await getClient().auth.signUp({
        email: record.email,
        password: record.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login.html`,
          captchaToken,
          data: {
            facility_name: record.facility_name,
            facility_type: record.facility_type,
            county: record.county,
            address: record.address,
            licence_number: record.licence_number,
            contact_person: record.contact_person,
            contact_role: record.contact_role,
            phone: record.phone,
          },
        },
      });

      if (error) {
        if (error.code === 'database_error' || error.message?.toLowerCase().includes('database error') || error.message?.includes('facility_profiles')) {
          throw new Error("We couldn't create this account. Check your details; this licence number may already be registered.");
        }
        throw new Error(error.message || 'Unable to create your account.');
      }
      return { needsEmailConfirmation: !data?.session };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("We couldn't create")) throw error;
      if (error?.code === 'database_error' || error?.message?.toLowerCase().includes('database error') || error?.message?.includes('facility_profiles')) {
        throw new Error("We couldn't create this account. Check your details; this licence number may already be registered.");
      }
      throw new Error(error?.message || 'Unable to create your account.');
    }
  }

  async function signIn(email, password, captchaToken) {
    if (!captchaToken) throw new Error('Please complete the verification.');
    const { data, error } = await getClient().auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: { captchaToken },
    });
    if (error || !data?.session) throw new Error('Incorrect email or password.');
    return data.session;
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw new Error(`Unable to sign out: ${error.message}`);
    return true;
  }

  async function resetPasswordForEmail(email, captchaToken) {
    if (!captchaToken) throw new Error('Please complete the verification.');
    const { error } = await getClient().auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: `${window.location.origin}/login.html`,
      captchaToken,
    });
    if (error) throw new Error('Unable to send the password reset email. Check the address and try again.');
    return true;
  }

  async function initializeNavigation() {
    const loginLinks = document.querySelectorAll('[data-nav-login]');
    const dashboardLinks = document.querySelectorAll('[data-nav-dashboard]');
    const logoutButtons = document.querySelectorAll('[data-nav-logout]');
    const status = document.querySelector('[data-nav-status]');
    try {
      const role = await getRole();
      if (!role) return;
      const dashboardUrl = role === 'admin' ? 'admin-dashboard.html' : 'facility-dashboard.html';
      loginLinks.forEach((link) => { link.hidden = true; });
      dashboardLinks.forEach((link) => {
        link.href = dashboardUrl;
        link.hidden = false;
      });
      logoutButtons.forEach((button) => { button.hidden = false; });
    } catch (error) {
      if (status) {
        status.textContent = error.message || 'Unable to check your sign-in status.';
        status.hidden = false;
      }
    }

    logoutButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await signOut();
          window.location.assign('index.html');
        } catch (error) {
          button.disabled = false;
          if (status) {
            status.textContent = error.message || 'Unable to sign out.';
            status.hidden = false;
          }
        }
      });
    });
  }

  async function getPreviewMedicines() {
    const { data, error } = await getClient().rpc('preview_medicines', { max_rows: 3 });
    if (error) throw new Error('Unable to load recently listed medicines.');
    return data || [];
  }

  async function getListingStats() {
    const { data, error } = await getClient().rpc('listing_stats');
    if (error) throw new Error('Unable to load listing statistics.');
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function getMyProfile() {
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Sign in to access your facility profile.');
    const { data, error } = await getClient()
      .from('facility_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw new Error('Unable to load your facility profile.');
    return data ? mapFacilityProfile(data) : null;
  }

  async function getBrowseMedicines() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await getClient()
      .from('medicines')
      .select('*')
      .eq('approval', 'approved')
      .gte('expiry_date', today)
      .order('expiry_date', { ascending: true });
    if (error) throw new Error('Unable to load available medicine listings.');
    return (data || []).map(mapMedicineRow);
  }

  async function getMyListings() {
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Sign in to access your medicine listings.');
    const { data, error } = await getClient()
      .from('medicines')
      .select('*')
      .eq('listed_by', session.user.id)
      .order('submitted_at', { ascending: false });
    if (error) throw new Error('Unable to load your medicine listings.');
    return (data || []).map(mapMedicineRow);
  }

  async function addMyListing(payload) {
    const quantity = Number.parseInt(payload?.quantity, 10);
    const record = {
      drug_name: String(payload?.drug_name || '').trim(),
      quantity,
      unit: String(payload?.unit || 'units').trim() || 'units',
      expiry_date: payload?.expiry_date,
      storage_condition: payload?.storage_condition || null,
      notes: payload?.notes || null,
    };
    if (!record.drug_name || !record.expiry_date || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Enter a medicine name, positive quantity, and expiry date.');
    }

    const { data, error } = await getClient()
      .from('medicines')
      .insert([record])
      .select()
      .single();
    if (error) {
      if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
        throw new Error('Your facility must be verified to do this.');
      }
      throw new Error(`Unable to add the medicine listing: ${error.message}`);
    }
    return mapMedicineRow(data);
  }

  async function withdrawMyListing(id) {
    const { error, count } = await getClient()
      .from('medicines')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw new Error(`Unable to withdraw the medicine listing: ${error.message}`);
    if (count === 0) throw new Error('Only your pending listings can be withdrawn.');
    return true;
  }

  async function submitTransferRequest(medicineId, details, deliveryLocation) {
    const { data, error } = await getClient()
      .from('transfer_requests')
      .insert([{
        medicine_id: medicineId,
        details: details || null,
        delivery_location: String(deliveryLocation || '').trim(),
      }])
      .select()
      .single();
    if (error) {
      if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
        throw new Error('Your facility must be verified to do this.');
      }
      throw new Error(`Unable to submit the transfer request: ${error.message}`);
    }
    return mapTransferRequestRow(data);
  }

  async function getMyRequests() {
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Sign in to access your transfer requests.');
    const { data, error } = await getClient()
      .from('transfer_requests')
      .select('*')
      .eq('requested_by', session.user.id)
      .order('submitted_at', { ascending: false });
    if (error) throw new Error('Unable to load your transfer requests.');
    return (data || []).map(mapTransferRequestRow);
  }

  async function getAllMedicines() {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('medicines')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw new Error(`Unable to load medicine listings: ${error.message}`);
    return (data || []).map(mapMedicineRow);
  }

  async function updateMedicineApproval(id, approval) {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('medicines')
      .update({ approval })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Unable to ${approval === 'approved' ? 'approve' : 'reject'} the medicine listing: ${error.message}`);
    return mapMedicineRow(data);
  }

  async function approveMedicine(id) {
    return updateMedicineApproval(id, 'approved');
  }

  async function rejectMedicine(id) {
    return updateMedicineApproval(id, 'rejected');
  }

  async function removeMedicine(id) {
    await requireAdmin();
    const { error } = await getClient().from('medicines').delete().eq('id', id);
    if (error) throw new Error(`Unable to remove the medicine listing: ${error.message}`);
    return true;
  }

  async function adminAddMedicine(payload) {
    await requireAdmin();
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
    if (error) throw new Error(`Unable to add the medicine listing: ${error.message}`);
    return mapMedicineRow(data);
  }

  async function getTransferRequests() {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('transfer_requests')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw new Error(`Unable to load transfer requests: ${error.message}`);
    return (data || []).map(mapTransferRequestRow);
  }

  async function updateTransferRequestStatus(id, status) {
    await requireAdmin();
    if (!['new', 'contacted', 'resolved'].includes(status)) {
      throw new Error('Invalid transfer request status.');
    }
    const { data, error } = await getClient()
      .from('transfer_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Unable to update the transfer request: ${error.message}`);
    return mapTransferRequestRow(data);
  }

  async function getFacilityProfiles(status) {
    await requireAdmin();
    let query = getClient()
      .from('facility_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (status && status !== 'all') {
      if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
        throw new Error('Invalid facility verification status.');
      }
      query = query.eq('verification_status', status);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Unable to load facility profiles: ${error.message}`);
    return (data || []).map(mapFacilityProfile);
  }

  async function setFacilityVerification(userId, status, notes) {
    await requireAdmin();
    if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) {
      throw new Error('Invalid facility verification status.');
    }
    const { data, error } = await getClient()
      .from('facility_profiles')
      .update({ verification_status: status, verification_notes: notes || null })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(`Unable to update facility verification: ${error.message}`);
    return mapFacilityProfile(data);
  }

  async function countRows(table, column, value, operator = 'eq') {
    const selectColumn = table === 'facility_profiles' ? 'user_id' : 'id';
    const selection = getClient().from(table).select(selectColumn, { count: 'exact', head: true });
    const query = operator === 'neq' ? selection.neq(column, value) : selection.eq(column, value);
    const { count, error } = await query;
    if (error) throw new Error(`Unable to load admin counts: ${error.message}`);
    return count || 0;
  }

  async function getAdminCounts() {
    await requireAdmin();
    const [verifiedFacilities, pendingVerifications, approvedListings, pendingListings, openRequests] = await Promise.all([
      countRows('facility_profiles', 'verification_status', 'approved'),
      countRows('facility_profiles', 'verification_status', 'pending'),
      countRows('medicines', 'approval', 'approved'),
      countRows('medicines', 'approval', 'pending'),
      countRows('transfer_requests', 'status', 'resolved', 'neq'),
    ]);
    return { verifiedFacilities, pendingVerifications, approvedListings, pendingListings, openRequests };
  }

  return {
    signUpFacility,
    signIn,
    signOut,
    getSession,
    getRole,
    initializeNavigation,
    resetPasswordForEmail,
    getPreviewMedicines,
    getListingStats,
    getMyProfile,
    getBrowseMedicines,
    getMyListings,
    addMyListing,
    withdrawMyListing,
    submitTransferRequest,
    getMyRequests,
    getAllMedicines,
    approveMedicine,
    rejectMedicine,
    removeMedicine,
    adminAddMedicine,
    getTransferRequests,
    updateTransferRequestStatus,
    getFacilityProfiles,
    setFacilityVerification,
    getAdminCounts,
  };
})();
