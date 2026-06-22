const { db } = require('../../apps/api/src/db/sqlite');
const { runMigrations } = require('../../apps/api/src/db/migrate');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function seed() {
  console.log('Starting database seeding...');
  
  // Ensure tables exist
  runMigrations();

  // Clear existing data (in order of foreign key dependency)
  db.serialize(() => {
    console.log('Clearing old database records...');
    db.run('DELETE FROM admin_actions');
    db.run('DELETE FROM consent_records');
    db.run('DELETE FROM availability_log');
    db.run('DELETE FROM disputes');
    db.run('DELETE FROM notifications');
    db.run('DELETE FROM auth_sessions');
    db.run('DELETE FROM voice_clarification_prompts');
    db.run('DELETE FROM voice_commands');
    db.run('DELETE FROM recommendations');
    db.run('DELETE FROM match_candidates');
    db.run('DELETE FROM match_candidate_sets');
    db.run('DELETE FROM fraud_flags');
    db.run('DELETE FROM trust_score_history');
    db.run('DELETE FROM endorsements');
    db.run('DELETE FROM ratings');
    db.run('DELETE FROM payments');
    db.run('DELETE FROM jobs');
    db.run('DELETE FROM bookings');
    db.run('DELETE FROM service_requests');
    db.run('DELETE FROM job_requirements');
    db.run('DELETE FROM verification_records');
    db.run('DELETE FROM customer_profiles');
    db.run('DELETE FROM contractor_profiles');
    db.run('DELETE FROM worker_profiles');
    db.run('DELETE FROM users');
    db.run('DELETE FROM agent_run_logs');
    db.run('DELETE FROM skills_taxonomy');
    console.log('Database cleared.');
  });

  const nowStr = () => new Date().toISOString();
  const pastStr = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  // Insert base Agent run log for seed actions
  const seedAgentRunId = uuidv4();
  db.run(`
    INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
    VALUES (?, 'VERIFICATION', '1.0.0', '{}', '{"status":"SUCCESS"}', '[]', 'SUCCESS', 5, ?)
  `, [seedAgentRunId, pastStr(30)]);

  // Users data
  const pwHash = await bcrypt.hash('password123', SALT_ROUNDS);

  // 1. ADMINS
  const adminMeeraId = uuidv4();
  const adminArjunId = uuidv4();
  
  db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'ADMIN', 'Meera Nair', '9876543210', 'meera.admin@labourlink.in', ?, ?)`, [adminMeeraId, pastStr(30), pastStr(30)]);
  db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'ADMIN', 'Arjun Sharma', '9876543211', 'arjun.admin@labourlink.in', ?, ?)`, [adminArjunId, pastStr(30), pastStr(30)]);

  // 1.1 SKILLS TAXONOMY (NEW)
  const skills = [
    { category: 'Construction', name: 'mason' },
    { category: 'Construction', name: 'painter' },
    { category: 'Construction', name: 'carpenter' },
    { category: 'Electrical', name: 'electrician' },
    { category: 'Electrical', name: 'ac technician' },
    { category: 'Plumbing', name: 'plumber' },
    { category: 'Plumbing', name: 'pipe fitter' },
    { category: 'Helper', name: 'helper' },
    { category: 'Domestic', name: 'cook' },
    { category: 'Domestic', name: 'cleaner' },
    { category: 'Domestic', name: 'domestic worker' }
  ];

  for (const s of skills) {
    db.run('INSERT INTO skills_taxonomy (id, category, name) VALUES (?, ?, ?)', [uuidv4(), s.category, s.name]);
  }

  // 1.2 CUSTOMERS (NEW)
  const customers = [
    { id: uuidv4(), name: 'Amit Roy', phone: '9000000101', address: 'Flat 402, Sunshine Apts, Andheri West, Mumbai', lat: 19.1197, lng: 72.8464, lang: 'hi' },
    { id: uuidv4(), name: 'Vijay Patel', phone: '9000000102', address: 'Block C, Noida Sector 15, NCR', lat: 28.5830, lng: 77.3140, lang: 'en' }
  ];

  for (const c of customers) {
    const userId = uuidv4();
    db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'CUSTOMER', ?, ?, ?, ?, ?)`, 
      [userId, c.name, c.phone, `${c.name.toLowerCase().replace(' ', '')}@email.com`, pastStr(30), pastStr(30)]);
    db.run(`INSERT INTO customer_profiles (id, user_id, home_address, home_lat, home_lng, preferred_language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.id, userId, c.address, c.lat, c.lng, c.lang, pastStr(30)]);
  }

  // 2. CONTRACTORS
  const contractors = [
    { id: uuidv4(), name: 'Suresh Kumar', phone: '9000000001', company: 'Suresh Construction Ltd', verified: 1 },
    { id: uuidv4(), name: 'Priya Patel', phone: '9000000002', company: 'Patel Painting Services', verified: 1 },
    { id: uuidv4(), name: 'Vikram Singh', phone: '9000000003', company: 'NCR Electrical Contractors', verified: 1 },
    { id: uuidv4(), name: 'Anand Rao', phone: '9000000004', company: 'Rao Plumbing & Sanitation', verified: 0 },
    { id: uuidv4(), name: 'Sunita Deshmukh', phone: '9000000005', company: 'Deshmukh Home Services', verified: 1 },
    { id: uuidv4(), name: 'Rajiv Mehta', phone: '9000000006', company: 'Mehta Logistics', verified: 0 }
  ];

  for (const c of contractors) {
    const userId = uuidv4();
    db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'CONTRACTOR', ?, ?, ?, ?, ?)`, 
      [userId, c.name, c.phone, `${c.name.toLowerCase().replace(' ', '')}@email.com`, pastStr(30), pastStr(30)]);
    db.run(`INSERT INTO contractor_profiles (id, user_id, company_name, verified_business, created_at) VALUES (?, ?, ?, ?, ?)`,
      [c.id, userId, c.company, c.verified, pastStr(30)]);
  }

  // 3. WORKERS
  // We'll define coordinate points near Delhi NCR (Latitude ~28.6, Longitude ~77.2)
  const workersData = [
    { name: 'Ramesh Prasad', phone: '8000000001', skills: ['mason', 'plasterer'], lat: 28.6139, lng: 77.2090, score: 92 },
    { name: 'Amit Verma', phone: '8000000002', skills: ['electrician', 'welder'], lat: 28.5355, lng: 77.3910, score: 88 },
    { name: 'Sunita Devi', phone: '8000000003', skills: ['domestic worker', 'cook'], lat: 28.7041, lng: 77.1025, score: 95 },
    { name: 'Rajesh Kumar', phone: '8000000004', skills: ['plumber', 'fitter'], lat: 28.4595, lng: 77.0266, score: 85 },
    { name: 'Sanjay Singh', phone: '8000000005', skills: ['painter', 'mason'], lat: 28.6500, lng: 77.2300, score: 79 },
    { name: 'Anita Bai', phone: '8000000006', skills: ['domestic worker', 'baby sitter'], lat: 28.5800, lng: 77.1500, score: null }, // Unestablished
    { name: 'Manoj Yadav', phone: '8000000007', skills: ['driver', 'helper'], lat: 28.4089, lng: 77.3178, score: 90 },
    { name: 'Vikram Rawat', phone: '8000000008', skills: ['carpenter', 'mason'], lat: 28.6300, lng: 77.0800, score: 82 },
    { name: 'Geeta Shinde', phone: '8000000009', skills: ['domestic worker', 'cleaner'], lat: 28.5100, lng: 77.2200, score: 87 },
    { name: 'Deepak Jha', phone: '8000000010', skills: ['electrician', 'plumber'], lat: 28.6800, lng: 77.3000, score: 64 }, // Low trust (due to a dispute / payment mismatch flags)
    { name: 'Karan Malhotra', phone: '8000000011', skills: ['welder', 'fitter'], lat: 28.5500, lng: 77.2500, score: 91 },
    { name: 'Bablu Sahni', phone: '8000000012', skills: ['mason', 'helper'], lat: 28.6200, lng: 77.3500, score: 72 }, // Medium trust
    { name: 'Pooja Sharma', phone: '8000000013', skills: ['cook', 'helper'], lat: 28.4700, lng: 77.0500, score: 86 },
    { name: 'Hari Prasad', phone: '8000000014', skills: ['painter', 'decorator'], lat: 28.5900, lng: 77.0100, score: 80 },
    { name: 'Dinesh Ram', phone: '8000000015', skills: ['plumber', 'mason'], lat: 28.6400, lng: 77.1200, score: 76 }
  ];

  const workers: { id: string; userId: string; name: string; score: number | null; lat: number; lng: number; skills: string[] }[] = [];

  for (const w of workersData) {
    const userId = uuidv4();
    const workerProfileId = uuidv4();
    
    // Add user
    db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'WORKER', ?, ?, ?, ?, ?)`, 
      [userId, w.name, w.phone, `${w.name.toLowerCase().replace(' ', '')}@email.com`, pastStr(30), pastStr(30)]);

    // Add profile
    const vStatus = w.score !== null ? 'VERIFIED' : 'PENDING';
    db.run(`
      INSERT INTO worker_profiles (id, user_id, skills, home_lat, home_lng, current_lat, current_lng, availability_status, verification_status, trust_score, trust_score_updated_at, trust_score_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, 1, ?)
    `, [workerProfileId, userId, JSON.stringify(w.skills), w.lat, w.lng, w.lat, w.lng, vStatus, w.score, w.score !== null ? pastStr(1) : null, pastStr(30)]);

    workers.push({
      id: workerProfileId,
      userId,
      name: w.name,
      score: w.score,
      lat: w.lat,
      lng: w.lng,
      skills: w.skills
    });

    // Verification records (Aadhaar & Skill Certs for established workers)
    if (w.score !== null) {
      db.run(`
        INSERT INTO verification_records (id, worker_id, type, status, evidence_url, verified_by_agent_run_id, created_at)
        VALUES (?, ?, 'ID_DOCUMENT', 'VERIFIED', 'https://verifications.labourlink.in/docs/aadhaar_verify.pdf', ?, ?)
      `, [uuidv4(), workerProfileId, seedAgentRunId, pastStr(28)]);

      db.run(`
        INSERT INTO verification_records (id, worker_id, type, status, evidence_url, verified_by_agent_run_id, created_at)
        VALUES (?, ?, 'SKILL_CERT', 'VERIFIED', 'https://verifications.labourlink.in/docs/skill_cert.pdf', ?, ?)
      `, [uuidv4(), workerProfileId, seedAgentRunId, pastStr(28)]);
    } else {
      // Unestablished worker has pending verification
      db.run(`
        INSERT INTO verification_records (id, worker_id, type, status, evidence_url, verified_by_agent_run_id, created_at)
        VALUES (?, ?, 'ID_DOCUMENT', 'PENDING', 'https://verifications.labourlink.in/docs/aadhaar_pending.jpg', NULL, ?)
      `, [uuidv4(), workerProfileId, pastStr(2)]);
    }

    // Consent Record
    db.run(`
      INSERT INTO consent_records (id, user_id, consent_type, granted, granted_via, created_at)
      VALUES (?, ?, 'VOICE_RECORDING', 1, 'UI', ?)
    `, [uuidv4(), userId, pastStr(25)]);
    
    db.run(`
      INSERT INTO consent_records (id, user_id, consent_type, granted, granted_via, created_at)
      VALUES (?, ?, 'DATA_PROCESSING', 1, 'UI', ?)
    `, [uuidv4(), userId, pastStr(25)]);

    // Availability log
    db.run(`
      INSERT INTO availability_log (id, worker_id, status, set_via, created_at)
      VALUES (?, ?, 'AVAILABLE', 'UI', ?)
    `, [uuidv4(), workerProfileId, pastStr(5)]);
  }

  // Helper to find worker ID by name
  const findWorker = (name: string) => workers.find(w => w.name === name)!;
  // Helper to find contractor ID by name
  const findContractor = (name: string) => contractors.find(c => c.name === name)!;

  // 4. SEED JOBS & REQUIREMENTS & RATINGS & PAYMENTS
  const sureshC = findContractor('Suresh Kumar');
  const priyaP = findContractor('Priya Patel');
  const vikramS = findContractor('Vikram Singh');
  const anandR = findContractor('Anand Rao');

  const rameshP = findWorker('Ramesh Prasad');
  const amitV = findWorker('Amit Verma');
  const sunitaD = findWorker('Sunita Devi');
  const rajeshK = findWorker('Rajesh Kumar');
  const deepakJ = findWorker('Deepak Jha');

  // Job Requirement 1: Masonry work for Suresh
  const req1Id = uuidv4();
  db.run(`
    INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Need a skilled mason for plastering a building in central Delhi, near Connaught Place.', ?, 28.6139, 77.2090, 10, 1, 80, 500, 800, ?, ?, ?, ?)
  `, [
    req1Id, sureshC.id, JSON.stringify(['mason', 'plasterer']), 
    pastStr(20), urgencyWindowEnd(20), seedAgentRunId, pastStr(20)
  ]);

  // Job 1: Ramesh did this job, completed, paid, rated
  const job1Id = uuidv4();
  db.run(`
    INSERT INTO jobs (id, job_requirement_id, worker_id, contractor_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 28.6139, 77.2090, ?)
  `, [
    job1Id, req1Id, rameshP.id, sureshC.id, 
    pastStr(18), pastStr(15), pastStr(15), pastStr(20)
  ]);

  // Payment 1 (Polymorphic)
  const pay1Id = uuidv4();
  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, 750, 'CONFIRMED', 'UPI_VERIFIED', ?, ?)
  `, [pay1Id, job1Id, pastStr(15), pastStr(15)]);

  // Rating 1 (Contractor rated Ramesh - Polymorphic)
  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 5.0, 'Ramesh was on time, skilled, and did excellent plastering.', ?)
  `, [uuidv4(), job1Id, sureshC.id, rameshP.id, pastStr(15)]);

  // Rating 1b (Ramesh rated Contractor - Polymorphic)
  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 5.0, 'Great contractor, paid promptly through UPI.', ?)
  `, [uuidv4(), job1Id, rameshP.userId, findContractorUserId(sureshC.id), pastStr(15)]);

  // Job Requirement 2: Electrical wiring for Vikram
  const req2Id = uuidv4();
  db.run(`
    INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Need an electrician for wiring installation in Noida Sector 62.', ?, 28.6282, 77.3769, 15, 1, 85, 600, 900, ?, ?, ?, ?)
  `, [
    req2Id, vikramS.id, JSON.stringify(['electrician']), 
    pastStr(15), urgencyWindowEnd(15), seedAgentRunId, pastStr(15)
  ]);

  // Job 2: Amit Verma did this job, completed, paid, rated
  const job2Id = uuidv4();
  db.run(`
    INSERT INTO jobs (id, job_requirement_id, worker_id, contractor_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 28.6282, 77.3769, ?)
  `, [
    job2Id, req2Id, amitV.id, vikramS.id, 
    pastStr(12), pastStr(10), pastStr(10), pastStr(15)
  ]);

  // Payment 2 (Polymorphic)
  const pay2Id = uuidv4();
  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, 850, 'CONFIRMED', 'UPI_VERIFIED', ?, ?)
  `, [pay2Id, job2Id, pastStr(10), pastStr(10)]);

  // Rating 2 (Polymorphic)
  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 4.5, 'Very professional wiring work. Clean and safe.', ?)
  `, [uuidv4(), job2Id, vikramS.id, amitV.id, pastStr(10)]);

  // Job Requirement 3: Housekeeping for Priya
  const req3Id = uuidv4();
  db.run(`
    INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Looking for home cleaning and domestic help in Dwarka.', ?, 28.5921, 77.0460, 8, 1, 90, 400, 600, ?, ?, ?, ?)
  `, [
    req3Id, priyaP.id, JSON.stringify(['domestic worker']), 
    pastStr(10), urgencyWindowEnd(10), seedAgentRunId, pastStr(10)
  ]);

  // Job 3: Sunita Devi completed
  const job3Id = uuidv4();
  db.run(`
    INSERT INTO jobs (id, job_requirement_id, worker_id, contractor_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 28.5921, 77.0460, ?)
  `, [
    job3Id, req3Id, sunitaD.id, priyaP.id, 
    pastStr(8), pastStr(6), pastStr(6), pastStr(10)
  ]);

  // Payment 3 (Polymorphic)
  const pay3Id = uuidv4();
  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, 500, 'CONFIRMED', 'CASH_ATTESTED', ?, ?)
  `, [pay3Id, job3Id, pastStr(6), pastStr(6)]);

  // Rating 3 (Polymorphic)
  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 5.0, 'Highly reliable, punctual, and cleans very thoroughly.', ?)
  `, [uuidv4(), job3Id, priyaP.id, sunitaD.id, pastStr(6)]);

  // Job Requirement 4: Plumbing work for Anand Rao (Unverified Business)
  const req4Id = uuidv4();
  db.run(`
    INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Urgent plumbing repair needed for leaky pipes in Gurugram Phase 3.', ?, 28.4595, 77.0266, 12, 1, 70, 450, 700, ?, ?, ?, ?)
  `, [
    req4Id, anandR.id, JSON.stringify(['plumber']), 
    pastStr(8), urgencyWindowEnd(8), seedAgentRunId, pastStr(8)
  ]);

  // Job 4: Rajesh Kumar completed
  const job4Id = uuidv4();
  db.run(`
    INSERT INTO jobs (id, job_requirement_id, worker_id, contractor_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 28.4595, 77.0266, ?)
  `, [
    job4Id, req4Id, rajeshK.id, anandR.id, 
    pastStr(6), pastStr(5), pastStr(5), pastStr(8)
  ]);

  // Payment 4 (Polymorphic)
  const pay4Id = uuidv4();
  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, 600, 'CONFIRMED', 'UPI_VERIFIED', ?, ?)
  `, [pay4Id, job4Id, pastStr(5), pastStr(5)]);

  // Rating 4 (Polymorphic)
  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 4.0, 'Fixed the leaks quickly, good plumber.', ?)
  `, [uuidv4(), job4Id, anandR.id, rajeshK.id, pastStr(5)]);

  // 5. DISPUTED JOB & LOW TRUST CASE (Deepak Jha)
  // Job Requirement 5: Leaky pipe repair for Suresh Kumar
  const req5Id = uuidv4();
  db.run(`
    INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Need a plumber in Connaught Place area to fix hotel kitchen pipes.', ?, 28.6139, 77.2090, 5, 1, 60, 800, 1200, ?, ?, ?, ?)
  `, [
    req5Id, sureshC.id, JSON.stringify(['plumber']), 
    pastStr(10), urgencyWindowEnd(10), seedAgentRunId, pastStr(10)
  ]);

  // Job 5: Deepak Jha took it, became disputed
  const job5Id = uuidv4();
  db.run(`
    INSERT INTO jobs (id, job_requirement_id, worker_id, contractor_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'DISPUTED', ?, ?, NULL, 28.6139, 77.2090, ?)
  `, [
    job5Id, req5Id, deepakJ.id, sureshC.id, 
    pastStr(8), pastStr(7), pastStr(10)
  ]);

  // Payment 5 is PENDING / DISPUTED (Polymorphic)
  const pay5Id = uuidv4();
  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, 1000, 'DISPUTED', 'BANK_VERIFIED', NULL, ?)
  `, [pay5Id, job5Id, pastStr(7)]);

  // Rating 5: Suresh rated Deepak 1 star (Polymorphic)
  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 1.0, 'Deepak arrived 4 hours late, did not complete the job, and left the water valve open causing leakage!', ?)
  `, [uuidv4(), job5Id, sureshC.id, deepakJ.id, pastStr(7)]);

  // Dispute record (Polymorphic)
  const disputeId = uuidv4();
  db.run(`
    INSERT INTO disputes (id, job_reference_type, job_reference_id, raised_by, reason, evidence, status, resolved_by, resolution_notes, created_at, resolved_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, 'Contractor refuses to pay. I worked for 3 hours and fixed the main pipeline. The leakage was from a different pipe that was not in my scope.', ?, 'OPEN', NULL, NULL, ?, NULL)
  `, [
    disputeId, job5Id, deepakJ.userId, 
    JSON.stringify({ photos: ['https://disputes.labourlink.in/evidence/photo_pipe.jpg'] }), 
    pastStr(7)
  ]);

  // 5.1 SEED CUSTOMER REQUESTS & BOOKINGS (NEW)
  const customerAmit = customers.find(c => c.name === 'Amit Roy')!;
  const sr1Id = uuidv4();
  db.run(`
    INSERT INTO service_requests (id, customer_id, raw_text, extracted_skills, lat, lng, radius_km, urgency_window_start, urgency_window_end, budget_min, budget_max, status, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Need a plumber to fix a leaking tap in my kitchen at Andheri West.', ?, 19.1197, 72.8464, 10, ?, ?, 300, 600, 'BOOKED', ?, ?)
  `, [
    sr1Id, customerAmit.id, JSON.stringify(['plumber']),
    pastStr(10), urgencyWindowEnd(10), seedAgentRunId, pastStr(10)
  ]);

  const booking1Id = uuidv4();
  db.run(`
    INSERT INTO bookings (id, service_request_id, worker_id, customer_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 19.1197, 72.8464, ?)
  `, [
    booking1Id, sr1Id, rajeshK.id, customerAmit.id,
    pastStr(8), pastStr(8), pastStr(8), pastStr(10)
  ]);

  const bookingPay1Id = uuidv4();
  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CUSTOMER_BOOKING', ?, 500, 'CONFIRMED', 'UPI_VERIFIED', ?, ?)
  `, [bookingPay1Id, booking1Id, pastStr(8), pastStr(8)]);

  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CUSTOMER_BOOKING', ?, ?, ?, 5.0, 'Fixed the leaking tap very quickly and charged fairly.', ?)
  `, [uuidv4(), booking1Id, customerAmit.id, rajeshK.userId, pastStr(8)]);

  // 6. ENDORSEMENTS
  db.run(`
    INSERT INTO endorsements (id, worker_id, endorser_id, skill, comment, created_at)
    VALUES (?, ?, ?, 'mason', 'Ramesh Prasad is my go-to mason. He worked with me for 6 months on a residential project.', ?)
  `, [uuidv4(), rameshP.id, sureshC.id, pastStr(14)]);

  db.run(`
    INSERT INTO endorsements (id, worker_id, endorser_id, skill, comment, created_at)
    VALUES (?, ?, ?, 'electrician', 'Amit is a highly certified wireman. Extremely safe and reliable.', ?)
  `, [uuidv4(), amitV.id, vikramS.id, pastStr(8)]);

  // 7. TRUST HISTORY ROWS (To demonstrate historic charts)
  // For Ramesh Prasad
  db.run(`
    INSERT INTO trust_score_history (id, worker_id, score, version, computed_by_agent_run_id, contributing_factors, created_at)
    VALUES (?, ?, 92, 1, ?, ?, ?)
  `, [
    uuidv4(), rameshP.id, seedAgentRunId, 
    JSON.stringify({ jobs_completed: 1, on_time_rate: 1, payment_integrity_factor: 1, average_contractor_rating: 5, endorsement_factor: 1, verification_factor: 2, fraud_penalty: 0, reliability_consistency_factor: 0, dispute_outcome_factor: 0 }),
    pastStr(15)
  ]);

  // For Deepak Jha (Low Trust)
  db.run(`
    INSERT INTO trust_score_history (id, worker_id, score, version, computed_by_agent_run_id, contributing_factors, created_at)
    VALUES (?, ?, 64, 1, ?, ?, ?)
  `, [
    uuidv4(), deepakJ.id, seedAgentRunId, 
    JSON.stringify({ jobs_completed: 0, on_time_rate: 0, payment_integrity_factor: 0, average_contractor_rating: 1, endorsement_factor: 0, verification_factor: 1, fraud_penalty: 20, reliability_consistency_factor: 0, dispute_outcome_factor: 10 }),
    pastStr(7)
  ]);

  // 8. FRAUD FLAGS (OPEN FRAUD CASES)
  // Fraud Case 1: Location Conflict for Deepak Jha
  // He completed a job in Gurugram and Delhi at the exact same hour!
  const fraudAgentRunId = uuidv4();
  db.run(`
    INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
    VALUES (?, 'FRAUD_DETECTION', '1.0.0', '{"job_id_1":"abc","job_id_2":"def"}', '{"alert":"LOCATION_CONFLICT"}', '[]', 'SUCCESS', 12, ?)
  `, [fraudAgentRunId, pastStr(4)]);

  db.run(`
    INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at, resolved_at)
    VALUES (?, 'WORKER', ?, 'LOCATION_CONFLICT', 'HIGH', ?, 'OPEN', ?, ?, NULL)
  `, [
    uuidv4(), deepakJ.id, 
    JSON.stringify({ 
      reason: 'Attempted to check into two active jobs simultaneously in Gurugram and Noida (45km apart)', 
      conflicting_job_ids: [job5Id, uuidv4()] 
    }), 
    fraudAgentRunId, pastStr(4)
  ]);

  // Fraud Case 2: Rating Collusion for a minor worker
  // Worker Bablu Sahni and Contractor Rajiv Mehta have a rating collusion flag
  const babluW = findWorker('Bablu Sahni');
  const rajivM = findContractor('Rajiv Mehta');
  db.run(`
    INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at, resolved_at)
    VALUES (?, 'WORKER', ?, 'RATING_COLLUSION', 'MEDIUM', ?, 'OPEN', ?, ?, NULL)
  `, [
    uuidv4(), babluW.id, 
    JSON.stringify({ 
      reason: 'Reciprocal 5-star ratings exchanged in 3 jobs lasting less than 2 hours each', 
      contractor_id: rajivM.id, 
      ratings_count: 3 
    }), 
    fraudAgentRunId, pastStr(3)
  ]);

  // 9. VOICE COMMANDS & DIALOGUES
  // Command 1: Ramesh searching for job by voice (successful)
  const voice1Id = uuidv4();
  db.run(`
    INSERT INTO voice_commands (id, user_id, raw_audio_ref, transcript, detected_language, intent, slots, confidence, status, routed_to_agent, agent_run_id, created_at)
    VALUES (?, ?, 'https://voice.labourlink.in/audio/voice1.wav', 'Mujhe CP Connaught Place mein plastering ya mason ka kaam chahiye', 'hi', 'JOB_SEARCH', ?, ?, 'ROUTED_TO_AGENT', 'WORKER_MATCHING', ?, ?)
  `, [
    voice1Id, rameshP.userId, 
    JSON.stringify({ skill: 'mason', location: 'Connaught Place' }),
    JSON.stringify({ stt: 0.96, intent: 0.94, slots: { skill: 0.95, location: 0.92 } }),
    seedAgentRunId, pastStr(3)
  ]);

  // Command 2: Bablu Sahni updating location by voice (needs clarification)
  const voice2Id = uuidv4();
  db.run(`
    INSERT INTO voice_commands (id, user_id, raw_audio_ref, transcript, detected_language, intent, slots, confidence, status, routed_to_agent, agent_run_id, created_at)
    VALUES (?, ?, 'https://voice.labourlink.in/audio/voice2.wav', 'Mera kaam badal do', 'hi', 'UPDATE_PROFILE', ?, ?, 'NEEDS_CLARIFICATION', 'NONE', NULL, ?)
  `, [
    voice2Id, babluW.id, 
    JSON.stringify({}),
    JSON.stringify({ stt: 0.88, intent: 0.82, slots: {} }),
    pastStr(2)
  ]);

  // Clarification Prompt for Command 2
  db.run(`
    INSERT INTO voice_clarification_prompts (id, voice_command_id, missing_field, prompt_text, resolved, resolved_voice_command_id, created_at)
    VALUES (?, ?, 'skill', 'Aap apna kaunsa kaam ya hunar badalna chahte hain? (Jaise electrician, plumber, ya mason)', 0, NULL, ?)
  `, [uuidv4(), voice2Id, pastStr(2)]);

  // 10. AUTH SESSIONS
  db.run(`
    INSERT INTO auth_sessions (id, user_id, device_fingerprint, ip_address, lat, lng, login_method, created_at, expired_at)
    VALUES (?, ?, 'dev_chrome_win11_2893', '103.45.12.89', 28.6139, 77.2090, 'PASSWORD', ?, NULL)
  `, [uuidv4(), rameshP.userId, pastStr(1)]);

  // Auth session for Deepak Jha (Location anomaly detection source)
  db.run(`
    INSERT INTO auth_sessions (id, user_id, device_fingerprint, ip_address, lat, lng, login_method, created_at, expired_at)
    VALUES (?, ?, 'dev_android_app_0911', '45.12.98.11', 26.8467, 80.9462, 'OTP', ?, NULL) -- Lucknow session!
  `, [uuidv4(), deepakJ.userId, pastStr(4)]);

  // 11. NOTIFICATIONS
  db.run(`
    INSERT INTO notifications (id, user_id, channel, type, payload, delivered, read_at, created_at)
    VALUES (?, ?, 'SMS', 'JOB_OFFER', ?, 1, ?, ?)
  `, [uuidv4(), rameshP.userId, JSON.stringify({ job_id: job1Id, title: 'New Job Offer from Suresh Kumar' }), pastStr(18), pastStr(18)]);

  db.run(`
    INSERT INTO notifications (id, user_id, channel, type, payload, delivered, read_at, created_at)
    VALUES (?, ?, 'IN_APP', 'FRAUD_ALERT', ?, 1, NULL, ?)
  `, [uuidv4(), deepakJ.userId, JSON.stringify({ alert_id: uuidv4(), title: 'Your profile has a Location Conflict flag under review' }), pastStr(4)]);

  console.log('Database seeding completed successfully.');
}

// Helper functions for dates and ids
function urgencyWindowEnd(daysAgo: number): string {
  return new Date(Date.now() - (daysAgo - 2) * 24 * 60 * 60 * 1000).toISOString();
}

function findContractorUserId(contractorId: string): string {
  const row = db.prepare('SELECT user_id FROM contractor_profiles WHERE id = ?').get(contractorId) as { user_id: string };
  return row ? row.user_id : '';
}

function getCustomerUserId(customerId: string): string {
  const row = db.prepare('SELECT user_id FROM customer_profiles WHERE id = ?').get(customerId) as { user_id: string };
  return row ? row.user_id : '';
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
