/* ─────────────────────────────────────────────────────────────
   data.js

   WORDS   = the words on the site, copied exactly from the project's
             first pitch draft. Change them together, on purpose.
   SAMPLES = made-up example people and problems, so the site has
             something to show. Every one is marked SAMPLE on the page.
             Replace them with real ones.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var WORDS = {
    name: '[Project Name]',
    tagline: 'A global map of local problems — Connecting concern into action.',
    headings: {
      problem: 'The Problem',
      solution: 'The Solution',
      product: 'Product & User Experience',
      cycle: 'The Operating Cycle',
      localGlobal: 'Local to Global Impact',
      business: 'Business & Revenue Model',
      trust: 'Content Moderation & Trust',
      roadmap: 'Development Roadmap',
      team: 'Team Structure',
      cta: 'Call to Action & Contact'
    },
    coreIssueLabel: 'Core Issue',
    coreIssue: 'Many people genuinely care about social and local issues but face significant barriers to action:',
    barriers: [
      ['Lack of a starting point', "People often don't know what issues exist in their immediate surroundings."],
      ['Lack of collaborators', 'Individuals with ideas lack team members with complementary skills.'],
      ['Scale barrier', 'People assume making an impact requires large-scale campaigns, overlooking smaller local issues on their own street.']
    ],
    limitationLabel: 'Limitation of Existing Solutions',
    limitation: 'Traditional petition, donation, and volunteer platforms operate top-down ("Do you want to sign/donate?"), rather than listening from the ground up ("What is happening around you?").',
    conceptLabel: 'Platform Concept',
    concept: 'An interactive map-based social network that connects Problems + People + Action.',
    breakthroughsLabel: 'Key Breakthroughs',
    breakthroughs: [
      'Enables citizens to pin local issues with a simple prompt: "I see this problem" (without needing an immediate solution).',
      'Transforms maps into a live, interactive visualization of real community needs.',
      'Connects individuals with diverse skill sets (design, engineering, content creation, event management) around a shared purpose.'
    ],
    coreInterfaceLabel: 'Core Interface',
    coreInterface: 'Multi-level interactive map',
    ecosystemLabel: '3-Layer Ecosystem',
    layers: {
      see: 'Observe and post real-world problems, needs and opportunities.',
      connect: 'Find collaborators who share the same concerns and possess complementary skills.',
      act: 'Form project teams and drive tangible real-world change.'
    },
    cycle: [['SEE', 'Observe'], ['SHARE', 'Post on Map'], ['DISCOVER', 'Others find it'], ['CONNECT', 'Build Team'], ['CREATE', 'Form Project'], ['ACT', 'Real-World Impact']],
    mindsetLabel: 'Mindset Shift',
    mindset: ['"I care"', '"I found something I want to do"', '"I found people to do it with"', '"We actually made a change."'],
    localGlobalLabel: 'Local Knowledge Meets Global Collaboration',
    localGlobal: 'A neighborhood issue on one street often mirrors systemic challenges elsewhere in the world.',
    globalUsers: 'Global users (e.g., from Canada, Kenya, Taiwan) can share proven solutions, insights, and frameworks with local communities facing similar challenges.',
    business: [
      ['orporate CSR/ESG Sponsorships', 'Enterprise accounts allowing corporations to fund and partner with high-impact community projects.'],
      ['Data & Insights for NGOs & Local Government', 'Subscription-based analytics providing anonymized community needs data for resource allocation.'],
      ['Premium & Impact Badges', 'Value-added features for project creators to highlight campaigns and increase reach.']
    ],
    moderation: [
      ['Community Upvoting/Verification', 'Local users verify the authenticity and accuracy of reported issues.'],
      ['Resolution Status Tracking', 'Updates and marks resolved issues to maintain an active, clutter-free map.'],
      ['AI-Powered Moderation', 'Automated detection of spam, inappropriate content, and incorrect geotagging.']
    ],
    roadmap: [
      ['Phase 1 (Months 1–2)', 'MVP Release (Alpha Web/App) focused on 1–2 university campuses or local districts.'],
      ['Phase 2 (Months 3–4)', 'Launch collaboration features (CONNECT module), optimize map UI & reach 5,000 active users.'],
      ['Phase 3 (Months 5–6)', 'Scale user base & pilot corporate CSR funding pipelines.']
    ],
    team: [
      ['Product Lead', 'Vision, strategy, and overall project management.'],
      ['UI/UX Designer', 'Interactive map experience, wireframing, and design system.'],
      ['Lead Developer', 'Architecture, Map API integration, and database management.'],
      ['Marketing & Community Lead', 'User research, growth, and community outreach.']
    ],
    ctaLabel: 'Call to Action',
    cta: 'Join us in turning every point on the map into tangible change in the real world.',
    needsLabel: 'Current Needs',
    needs: 'Seeking Seed Funding, Mentors, and Trial Partners.',
    contactLabel: 'Contact Information',
    contact: 'Email, Phone Number, Website / Social Media Links.',
    prompt: 'I see this problem',
    promptHint: '(without needing an immediate solution)',
    skills: ['design', 'engineering', 'content creation', 'event management']
  };

  /* ───────── samples (made up) ─────────
     ago = minutes before the demo was first opened. */
  var M = 1, H = 60, D = 1440;

  var PEOPLE = [
    ['team', '[Project Name] team', 'Triêm Tây', 'Vietnam', 15.890, 108.290, ['design', 'engineering', 'content creation', 'event management'], ['starting point', 'collaborators']],
    ['hoian', 'Designer in Hội An', 'Hội An', 'Vietnam', 15.884, 108.335, ['design', 'event management'], ['waste', 'water']],
    ['hanoi', 'Designer in Hanoi', 'Hanoi', 'Vietnam', 21.005, 105.830, ['design', 'content creation'], ['walking', 'waste']],
    ['hcmc', 'Content creator in Ho Chi Minh City', 'Ho Chi Minh City', 'Vietnam', 10.800, 106.660, ['content creation', 'design'], ['water', 'climate']],
    ['danang', 'Event organizer in Da Nang', 'Da Nang', 'Vietnam', 16.070, 108.210, ['event management'], ['waste', 'water']],
    ['taipei', 'Event organizer in Taipei', 'Taipei', 'Taiwan', 25.060, 121.520, ['event management', 'content creation'], ['access', 'loneliness']],
    ['taipei2', 'Engineer in Taipei', 'Taipei', 'Taiwan', 25.030, 121.570, ['engineering'], ['waste', 'water']],
    ['edmonton', 'Engineer in Edmonton', 'Edmonton', 'Canada', 53.520, -113.530, ['engineering', 'design'], ['transit', 'weather']],
    ['yangon', 'Event organizer in Yangon', 'Yangon', 'Myanmar', 16.820, 96.170, ['event management'], ['transit', 'heat']],
    ['saopaulo', 'Designer in São Paulo', 'São Paulo', 'Brazil', -23.585, -46.670, ['design'], ['green space', 'volunteers']],
    ['tokyo', 'Event organizer in Tokyo', 'Tokyo', 'Japan', 35.660, 139.730, ['event management'], ['loneliness', 'elderly']],
    ['dubai', 'Engineer in Dubai', 'Dubai', 'United Arab Emirates', 25.180, 55.300, ['engineering'], ['food', 'waste']],
    ['kathmandu', 'Content creator in Kathmandu', 'Kathmandu', 'Nepal', 27.690, 85.340, ['content creation'], ['air', 'health']],
    ['arusha', 'Content creator in Arusha', 'Arusha', 'Tanzania', -3.370, 36.690, ['content creation', 'event management'], ['school', 'health']],
    ['mumbai', 'Engineer in Mumbai', 'Mumbai', 'India', 19.100, 72.880, ['engineering', 'content creation'], ['water', 'climate']],
    ['delhi', 'Designer in Delhi', 'Delhi', 'India', 28.620, 77.220, ['design'], ['heat', 'air']],
    ['nairobi', 'Engineer in Nairobi', 'Nairobi', 'Kenya', -1.300, 36.790, ['engineering'], ['waste', 'water']],
    ['lagos', 'Content creator in Lagos', 'Lagos', 'Nigeria', 6.540, 3.360, ['content creation'], ['safety', 'walking']],
    ['mexico', 'Engineer in Mexico City', 'Mexico City', 'Mexico', 19.420, -99.130, ['engineering', 'design'], ['water']],
    ['seoul', 'Designer in Seoul', 'Seoul', 'South Korea', 37.570, 126.980, ['design', 'content creation'], ['safety', 'school']],
    ['manila', 'Event organizer in Manila', 'Manila', 'Philippines', 14.610, 120.990, ['event management', 'engineering'], ['water', 'climate']],
    ['berlin', 'Designer in Berlin', 'Berlin', 'Germany', 52.510, 13.390, ['design'], ['elderly', 'public space']],
    ['bogota', 'Content creator in Bogotá', 'Bogotá', 'Colombia', 4.690, -74.060, ['content creation'], ['animals']],
    ['cairo', 'Engineer in Cairo', 'Cairo', 'Egypt', 30.060, 31.250, ['engineering'], ['waste', 'water']],
    ['lima', 'Event organizer in Lima', 'Lima', 'Peru', -12.060, -77.030, ['event management', 'content creation'], ['school']],
    ['jakarta', 'Content creator in Jakarta', 'Jakarta', 'Indonesia', -6.190, 106.830, ['content creation'], ['air', 'school']],
    ['accra', 'Designer in Accra', 'Accra', 'Ghana', 5.580, -0.200, ['design', 'event management'], ['waste', 'water']],
    ['hongkong', 'Engineer in Hong Kong', 'Hong Kong', 'Hong Kong', 22.330, 114.160, ['engineering'], ['elderly', 'access']]
  ].map(function (r) {
    return { id: 'u-' + r[0], name: r[1], city: r[2], country: r[3], lat: r[4], lon: r[5], skills: r[6], cares: r[7], sample: true };
  });

  function q(by, text, ago, answer) { return { by: 'u-' + by, text: text, ago: ago, answer: answer ? { by: 'u-' + answer[0], text: answer[1], ago: answer[2] } : null }; }
  function seen(list, ago) { return list.map(function (b, i) { return { by: 'u-' + b, ago: ago - i * 7 * H }; }); }
  function team(list) { return list.map(function (m) { return { by: 'u-' + m[0], skill: m[1], ago: m[2] }; }); }
  function upd(by, text, ago) { return { by: 'u-' + by, text: text, ago: ago }; }

  var PROBLEMS = [
    { id: 'origin', by: 'team', t: '2026-08-20T09:00:00Z',
      text: 'Many people genuinely care about social and local issues but face significant barriers to action',
      bullets: WORDS.barriers.map(function (b) { return b[0] + ': ' + b[1]; }),
      place: 'Triêm Tây', country: 'Vietnam', lat: 15.890, lon: 108.290, scale: 'world', tags: ['starting point', 'collaborators'],
      seenExtra: 10, needs: WORDS.skills.slice(),
      team: team([['hoian', 'design', 20 * D], ['arusha', 'content creation', 18 * D]]),
      questions: [q('berlin', 'Who are the first users: students, or everyone?', 15 * D)] },
    { id: 'hoian-river', by: 'hoian', ago: 2 * D, text: 'Plastic piles up along the river after every heavy rain.',
      place: 'Hội An', country: 'Vietnam', lat: 15.877, lon: 108.327, scale: 'city', tags: ['waste', 'water'],
      seen: seen(['danang', 'hcmc'], 40 * H), seenExtra: 12, needs: ['design', 'content creation', 'event management'],
      questions: [q('arusha', 'Does it come from upstream, or from the market?', 30 * H, ['hoian', 'Mostly the market. The bags come down the drains when it rains.', 26 * H])] },
    { id: 'hanoi-sidewalk', by: 'hanoi', ago: 5 * H, text: 'Motorbikes are parked across the whole sidewalk, so people with strollers walk in the road.',
      place: 'Hanoi', country: 'Vietnam', lat: 21.028, lon: 105.853, scale: 'street', approx: true, tags: ['walking', 'safety'], needs: ['design', 'event management'] },
    { id: 'hcmc-flood', by: 'hcmc', ago: 7 * D, text: 'Streets flood at high tide, even on days with no rain.',
      place: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.776, lon: 106.700, scale: 'city', tags: ['water', 'climate'],
      seen: seen(['mumbai'], 6 * D), seenExtra: 40, needs: ['engineering', 'design', 'content creation'],
      team: team([['manila', 'engineering', 4 * D]]),
      questions: [q('mumbai', 'Which streets flood first? Is there a pattern?', 5 * D)] },
    { id: 'danang-beach', by: 'danang', ago: 20 * D, text: 'After every storm the beach is covered in plastic.',
      place: 'Da Nang', country: 'Vietnam', lat: 16.054, lon: 108.247, scale: 'city', tags: ['waste', 'water', 'climate'],
      seenExtra: 30, needs: ['event management', 'content creation'],
      team: team([['danang', 'event management', 16 * D], ['hcmc', 'content creation', 14 * D]]),
      questions: [q('cairo', 'Is it the same plastic every time, or new each storm?', 18 * D, ['danang', 'New each storm. Most of it is bags and bottles.', 17 * D])],
      project: { name: 'Monthly beach walk', by: 'danang', ago: 12 * D, updates: [upd('danang', 'First walk: 14 people, 32 bags.', 9 * D), upd('hcmc', 'Made a short video of the walk for school groups.', 3 * D)] } },
    { id: 'taipei-arcade', by: 'taipei', ago: 21 * D, text: "Scooters are parked in the arcade walkway (騎樓), so wheelchairs can't get through.",
      place: 'Taipei', country: 'Taiwan', lat: 25.042, lon: 121.543, scale: 'street', approx: true, tags: ['walking', 'access'],
      seen: seen(['hongkong'], 19 * D), seenExtra: 22, needs: ['design', 'content creation', 'event management'],
      team: team([['taipei', 'event management', 15 * D], ['seoul', 'design', 13 * D], ['lima', 'content creation', 12 * D]]),
      questions: [q('hanoi', 'Do the shops own the walkway, or the city?', 18 * D, ['taipei', "The shops, mostly. That's why nobody moves the scooters.", 17 * D])],
      project: { name: 'Clear the 騎樓', by: 'taipei', ago: 10 * D, updates: [] } },
    { id: 'taipei-oil', by: 'taipei2', ago: 1 * D, text: 'Night-market stalls pour used cooking oil down the street drain.',
      place: 'Taipei', country: 'Taiwan', lat: 25.051, lon: 121.575, scale: 'street', approx: true, tags: ['waste', 'water'],
      seen: seen(['accra'], 20 * H), needs: ['engineering', 'content creation'] },
    { id: 'edmonton-bus', by: 'edmonton', ago: 4 * D, text: 'Bus shelters have no heat, and people wait outside at −30°C.',
      place: 'Edmonton', country: 'Canada', lat: 53.543, lon: -113.492, scale: 'city', tags: ['transit', 'weather'],
      seen: seen(['berlin'], 3 * D), seenExtra: 8, needs: ['engineering', 'content creation'],
      questions: [q('yangon', 'Is it worse at some stops than others?', 2 * D)] },
    { id: 'yangon-shade', by: 'yangon', ago: 1 * D, text: 'The bus stop has no shade, and people wait in the afternoon sun.',
      place: 'Yangon', country: 'Myanmar', lat: 16.803, lon: 96.156, scale: 'street', approx: true, tags: ['transit', 'weather', 'heat'], needs: ['design', 'engineering'] },
    { id: 'saopaulo-garden', by: 'saopaulo', ago: 6 * D, text: 'The community garden has water and seeds, but nobody looks after it.',
      place: 'São Paulo', country: 'Brazil', lat: -23.561, lon: -46.656, scale: 'street', approx: true, tags: ['green space', 'volunteers'],
      seenExtra: 10, needs: ['event management', 'content creation'], team: team([['bogota', 'content creation', 3 * D]]),
      questions: [q('tokyo', 'Who planted it in the first place?', 5 * D)] },
    { id: 'tokyo-neighbours', by: 'tokyo', ago: 60 * D, text: 'Older neighbours in our building live alone, and nobody knows their names.',
      place: 'Tokyo', country: 'Japan', lat: 35.694, lon: 139.703, scale: 'street', approx: true, tags: ['loneliness', 'elderly'],
      seen: seen(['berlin'], 58 * D), seenExtra: 30, needs: ['event management', 'design', 'content creation'],
      team: team([['tokyo', 'event management', 50 * D], ['seoul', 'design', 48 * D], ['taipei', 'content creation', 47 * D]]),
      questions: [q('taipei', 'Would they come to something, or would they rather have a visit?', 55 * D, ['tokyo', 'A visit first. Then they came to tea.', 40 * D])],
      project: { name: 'Tea on the third floor', by: 'tokyo', ago: 45 * D, updates: [upd('tokyo', 'First tea afternoon: six neighbours came.', 30 * D), upd('seoul', 'Made a name board for the lobby.', 14 * D)] } },
    { id: 'dubai-food', by: 'dubai', ago: 120 * D, text: 'Leftover food from school events goes straight in the bin.',
      place: 'Dubai', country: 'United Arab Emirates', lat: 25.204, lon: 55.271, scale: 'city', tags: ['food', 'waste'],
      seenExtra: 17, needs: ['event management', 'engineering'],
      team: team([['dubai', 'engineering', 110 * D], ['lima', 'event management', 105 * D]]),
      project: { name: 'Friday food pickup', by: 'dubai', ago: 100 * D,
        updates: [upd('dubai', 'Found a shelter that takes cooked food.', 90 * D), upd('lima', 'Three schools now call before they throw food away.', 60 * D)],
        resolved: { by: 'u-dubai', ago: 30 * D, note: 'Pickups run every Friday.' } } },
    { id: 'kathmandu-dust', by: 'kathmandu', ago: 3 * D, text: 'Dust from road works makes the walk to school hard to breathe.',
      place: 'Kathmandu', country: 'Nepal', lat: 27.705, lon: 85.320, scale: 'city', tags: ['air', 'walking', 'health'],
      seen: seen(['jakarta'], 2 * D), seenExtra: 26, needs: ['content creation', 'engineering'],
      questions: [q('hanoi', 'Do the road workers get masks too?', 1 * D)] },
    { id: 'tz-pads', by: 'arusha', ago: 35 * D, text: 'Many girls miss school every month because pads cost too much.',
      place: 'Tanzania', country: 'Tanzania', lat: -6.37, lon: 34.89, scale: 'country', tags: ['school', 'health'],
      seenExtra: 63, needs: ['event management', 'content creation', 'design'],
      team: team([['arusha', 'content creation', 32 * D], ['accra', 'event management', 31 * D], ['berlin', 'design', 30 * D]]),
      questions: [q('kathmandu', 'Are reusable pads accepted, or is there stigma?', 33 * D, ['arusha', 'Accepted, if older students explain them first.', 32 * D])],
      project: { name: 'Pad bank at two schools', by: 'arusha', ago: 28 * D, updates: [upd('arusha', 'Two schools agreed to host a pad bank.', 20 * D), upd('accra', 'Sewing workshop: 30 reusable pads made.', 7 * D)] } },
    { id: 'mumbai-drain', by: 'mumbai', ago: 8 * H, text: 'The drain on our lane overflows every monsoon, and nobody knows who to call.',
      place: 'Mumbai', country: 'India', lat: 19.060, lon: 72.836, scale: 'street', approx: true, tags: ['water', 'who to call'], needs: ['engineering', 'content creation'] },
    { id: 'southasia-heat', by: 'delhi', ago: 14 * D, text: 'Heatwaves come earlier and last longer every summer.',
      place: 'South Asia', country: 'India', lat: 22.5, lon: 79.0, scale: 'continent', tags: ['heat', 'climate'],
      seenExtra: 211, needs: ['content creation', 'design', 'engineering'],
      questions: [q('edmonton', 'Which cities already have cooling centres?', 10 * D)] },
    { id: 'nairobi-bins', by: 'nairobi', ago: 30 * D, text: 'Matatu stops have no bins, so plastic ends up in the gutter.',
      place: 'Nairobi', country: 'Kenya', lat: -1.284, lon: 36.823, scale: 'city', tags: ['waste', 'transit'],
      seenExtra: 18, needs: ['engineering', 'design', 'event management'],
      team: team([['nairobi', 'engineering', 25 * D], ['accra', 'design', 24 * D], ['lima', 'event management', 23 * D]]),
      questions: [q('hoian', 'Who would empty the bins?', 27 * D, ['nairobi', 'The stop managers said they would, if the bins are there.', 26 * D])],
      project: { name: 'Bins at two stops', by: 'nairobi', ago: 20 * D, updates: [upd('nairobi', 'Counted bottles at one stop for a week.', 15 * D)] } },
    { id: 'lagos-lights', by: 'lagos', ago: 2 * D, text: 'Our street has no working streetlights, so people avoid walking after dark.',
      place: 'Lagos', country: 'Nigeria', lat: 6.524, lon: 3.379, scale: 'street', approx: true, tags: ['safety', 'walking'],
      seen: seen(['bogota', 'cairo'], 40 * H), seenExtra: 3, needs: ['engineering', 'content creation'] },
    { id: 'mexico-water', by: 'mexico', ago: 9 * D, text: 'Tap water is cut off for hours most afternoons in our neighbourhood.',
      place: 'Mexico City', country: 'Mexico', lat: 19.360, lon: -99.100, scale: 'city', tags: ['water'],
      seenExtra: 15, needs: ['engineering', 'design', 'content creation'], team: team([['mexico', 'engineering', 6 * D]]) },
    { id: 'seoul-scooters', by: 'seoul', ago: 12 * H, text: 'Delivery scooters ride on the sidewalk right by the school gate.',
      place: 'Seoul', country: 'South Korea', lat: 37.550, lon: 126.990, scale: 'street', approx: true, tags: ['safety', 'school', 'walking'], needs: ['design', 'event management'] },
    { id: 'manila-typhoon', by: 'manila', ago: 50 * D, text: 'After typhoons, families on our street wait days for clean water.',
      place: 'Manila', country: 'Philippines', lat: 14.600, lon: 120.980, scale: 'city', tags: ['water', 'climate'],
      seenExtra: 40, needs: ['engineering', 'event management'],
      team: team([['manila', 'event management', 45 * D], ['mexico', 'engineering', 44 * D]]),
      questions: [q('mexico', 'How many families? Ten, or hundreds?', 47 * D, ['manila', 'About forty on our street.', 46 * D])],
      project: { name: 'Water filter shelf', by: 'manila', ago: 40 * D, updates: [upd('manila', 'Built one filter from a bucket and sand. The water tested clear.', 25 * D)] } },
    { id: 'berlin-bench', by: 'berlin', ago: 5 * D, text: 'The only bench on our block was taken away, and older people have nowhere to rest.',
      place: 'Berlin', country: 'Germany', lat: 52.530, lon: 13.410, scale: 'street', approx: true, tags: ['elderly', 'public space'],
      seenExtra: 6, needs: ['design', 'content creation'] },
    { id: 'bogota-dogs', by: 'bogota', ago: 16 * H, text: 'Stray dogs on our street have no water in the dry season.',
      place: 'Bogotá', country: 'Colombia', lat: 4.711, lon: -74.072, scale: 'street', approx: true, tags: ['animals', 'water'],
      seen: seen(['saopaulo'], 10 * H), needs: ['event management'] },
    { id: 'cairo-canal', by: 'cairo', ago: 11 * D, text: 'Plastic bags pile up along the canal.',
      place: 'Cairo', country: 'Egypt', lat: 30.044, lon: 31.236, scale: 'city', tags: ['waste', 'water'],
      seenExtra: 9, needs: ['engineering', 'event management', 'content creation'], team: team([['cairo', 'engineering', 8 * D]]) },
    { id: 'lima-library', by: 'lima', ago: 40 * D, text: 'Our neighbourhood has no library open on weekends.',
      place: 'Lima', country: 'Peru', lat: -12.046, lon: -77.043, scale: 'city', tags: ['school'],
      seenExtra: 12, needs: ['event management', 'design'],
      team: team([['lima', 'event management', 35 * D], ['saopaulo', 'design', 33 * D]]),
      project: { name: 'Weekend book box', by: 'lima', ago: 30 * D, updates: [] } },
    { id: 'jakarta-smoke', by: 'jakarta', ago: 6 * D, text: 'Traffic smoke makes the walk to school hard to breathe.',
      place: 'Jakarta', country: 'Indonesia', lat: -6.209, lon: 106.846, scale: 'city', tags: ['air', 'school', 'walking'],
      seen: seen(['kathmandu'], 5 * D), seenExtra: 14, needs: ['content creation', 'engineering'],
      questions: [q('kathmandu', 'Is there a quieter route to school?', 4 * D)] },
    { id: 'accra-drain', by: 'accra', ago: 3 * D, text: 'The market drain is blocked with plastic every week.',
      place: 'Accra', country: 'Ghana', lat: 5.603, lon: -0.187, scale: 'street', approx: true, tags: ['waste', 'water'],
      seenExtra: 4, needs: ['engineering', 'event management'] },
    { id: 'hk-stairs', by: 'hongkong', ago: 4 * D, text: "Older people in our building can't carry groceries up five floors.",
      place: 'Hong Kong', country: 'Hong Kong', lat: 22.319, lon: 114.169, scale: 'street', approx: true, tags: ['elderly', 'access'],
      seenExtra: 7, needs: ['engineering', 'event management'], team: team([['hongkong', 'engineering', 2 * D]]) }
  ].map(function (p) {
    p.by = 'u-' + p.by; p.sample = true;
    p.seen = p.seen || []; p.seenExtra = p.seenExtra || 0; p.questions = p.questions || []; p.team = p.team || [];
    if (p.project) {
      p.project.by = 'u-' + p.project.by;
      p.project.resolved = p.project.resolved || null;
    }
    return p;
  });

  var REPORTS = [
    { id: 'r-sample', target: 'accra-drain', by: 'u-lagos', reason: 'Wrong location', note: 'The market is a few streets north.', ago: 20 * H }
  ];

  var TAGS = ['waste', 'water', 'walking', 'transit', 'heat', 'weather', 'air', 'school', 'health', 'loneliness', 'elderly', 'food', 'green space', 'safety', 'access', 'climate', 'volunteers', 'animals', 'public space'];

  window.MAPDATA = { WORDS: WORDS, PEOPLE: PEOPLE, PROBLEMS: PROBLEMS, REPORTS: REPORTS, TAGS: TAGS };
})();
