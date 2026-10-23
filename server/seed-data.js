// Default content – taken from the original static website.
// It is only written to the database the first time (or when a group is missing),
// after which everything is edited from the admin panel.

const BOOKING = 'https://bit.ly/elixirsalonandspaBooking';

const settings = {
  brand: {
    name: 'Elixir Salon & Spa',
    tagline: 'Pamper. Relax. Renew.',
    logo: '/resources/elixir_logo.png',
    bookingUrl: BOOKING,
    gtmId: 'GTM-TPZVJ3LH',
    creditLabel: 'Built and Managed By',
    creditName: 'AdConnect.',
    creditUrl: 'https://adconnect.co.ke',
  },

  theme: {
    green: '#1A5B38',
    gold: '#D4AC52',
    ground: '#2A2519',
  },

  seo: {
    title: 'Elixir Salon & Spa | Hair, Beauty & Spa in Kilimani, Nairobi',
    description:
      'Step into a world of luxury where beauty meets relaxation. Hair, waxing, body scrubs, make-up, lashes, brows and grooming at Elixir Salon & Spa, Kilimani, Nairobi.',
    ogImage: '/resources/home-back-photo.jpeg',
  },

  // Fixed order – owners can rename, hide, or remove from the menu.
  sections: [
    { key: 'home', id: 'sectionHome', label: 'Home', nav: true, visible: true },
    { key: 'about', id: 'sectionAboutUs', label: 'About Us', nav: true, visible: true },
    { key: 'services', id: 'sectionOurServices', label: 'Our Services', nav: true, visible: true },
    { key: 'gallery', id: 'sectionGallery', label: 'Gallery', nav: true, visible: true },
    { key: 'booking', id: 'sectionBooking', label: 'Booking', nav: false, visible: true },
    { key: 'contact', id: 'sectionContactUs', label: 'Contact Us', nav: true, visible: true },
    { key: 'work', id: 'sectionWorkWithUs', label: 'Work With Us', nav: true, visible: true },
    { key: 'promo', id: 'sectionPromotion', label: 'Promo', nav: true, visible: true },
    { key: 'testimonials', id: 'sectionTestimonial', label: 'Testimonials', nav: true, visible: true },
  ],

  hero: {
    headline: 'Experience Luxury and Style at Elixir Salon & Spa',
    subheadline:
      'Step into a world of luxury where beauty meets relaxation. Discover our exclusive range of services designed to help you look and feel your best.',
    stats: [
      { value: '10+', label: 'Years of Experience' },
      { value: '30+', label: 'Our Awesome Experts' },
      { value: '50K+', label: 'Happy Customers' },
    ],
    primaryCta: 'Book Appointment Now',
    secondaryCta: 'Explore Our Services',
    slides: [
      '/resources/home-back-photo.jpeg',
      '/resources/home-back-photo1.jpeg',
      '/resources/serve2.jpeg',
      '/resources/serv3.jpeg',
      '/resources/serv8.jpeg',
    ],
  },

  about: {
    heading: 'Your Trusted Partner in Beauty & Wellness',
    body:
      'At Elixir Salon & Spa, we have redefined beauty and relaxation, creating a sanctuary where artistry meets care and comfort. Founded by Edith Odiawo, a seasoned professional with over 10 years of experience in the beauty industry, our salon and spa are a testament to her dedication, passion, and vision. Edith has built a reputation for excellence, bringing a touch of sophistication and warmth to every service she provides.',
    image: '/resources/owner.jpeg',
    cta: 'Learn More About Us',
    heading2: 'Our Story, Your Experience',
    body2:
      'Elixir Salon & Spa is more than just a beauty destination; it’s a space where clients of all ages and backgrounds can feel valued, rejuvenated, and empowered.\n\nWith Edith at the helm and a talented team of professionals, we deliver personalized services that cater to your unique preferences. Our team shares a commitment to excellence, ensuring every client leaves feeling refreshed, confident, and beautiful.\n\nWhether you visit us for a transformative haircut, a luxurious spa treatment, or expert grooming, we promise to make your experience memorable. At Elixir Salon & Spa, your beauty is our passion, and your satisfaction is our priority.',
    image2: '/resources/elix.jpeg',
    cta2: 'Meet Our Team',
  },

  servicesSection: {
    heading: 'Explore Our Premium Services',
    intro: '',
    bookLabel: 'Book Now',
    emptyNote: 'Pricing for this service is shared on consultation. Message us or book online and we will take care of the rest.',
    priceHeading: 'Service',
    priceHeading2: 'Price (KES)',
  },

  gallerySection: {
    heading: 'A Glimpse of Elixir',
    intro: 'Moments from our chairs, treatment rooms and happy clients.',
  },

  booking: {
    heading: 'Book Your Experience Today',
    subheading: 'Team of Professionals is Waiting for You.',
    text: 'Choose your service, select a date and time, and confirm your appointment in minutes.',
    cta: 'Book Appointment',
    image: '/resources/serv3.jpeg',
    image2: '/resources/serv4.jpeg',
  },

  contact: {
    heading: 'We’d Love to Hear from You.',
    intro:
      'We are here to answer all your questions and assist with your bookings. Feel free to contact us anytime!',
    formIntro: 'Please fill out the form below, and we’ll get back to you as soon as possible.',
    email: 'info@elixirsalonandspa.co.ke',
    phone: '+254 717 733 000',
    phone2: '+254 777 733 004',
    whatsapp: '+254 717 733 000',
    whatsappMessage: 'Hello, I am interested in your services!',
    hoursNote: '',
    address: 'Kilimani, Commodore Office Suite, G3',
    mapsUrl: 'https://maps.google.com/?cid=16060609366277038593&entry=gps&g_st=aw',
    hours: [
      { days: 'Mon', time: '09:00 – 20:00' },
      { days: 'Tue – Fri', time: '07:30 – 20:00' },
      { days: 'Sat', time: '08:00 – 20:00' },
      { days: 'Sun', time: '09:00 – 17:00' },
    ],
    social: [
      { platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=61571514984682' },
      { platform: 'x-twitter', url: '' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@elixrexecutive?lang=en' },
      { platform: 'instagram', url: 'https://www.instagram.com/elixirexecutive/' },
      { platform: 'youtube', url: '' },
    ],
  },

  work: {
    heading: 'Job Opportunities',
    intro:
      'At Elixir Salon & Spa, we’re always on the lookout for passionate, talented, and creative individuals to join our growing team! If you’re ready to bring beauty and confidence to our clients, we’d love to hear from you.',
    whyHeading: 'Why Join Us?',
    why: [
      'A supportive and inclusive work environment.',
      'Opportunities for professional growth and training.',
      'Work with the latest tools and trends in the beauty industry.',
    ],
    openingsHeading: 'Current Openings',
    requirementsHeading: 'Requirements',
    requirements: [
      'Relevant qualifications or certifications for the position applied for.',
      'A minimum of 2 years of experience (varies by role).',
      'Passion for providing exceptional customer service.',
      'Strong teamwork and communication skills.',
    ],
    cta: 'Apply Now',
    image: '/resources/serv9.jpeg',
  },

  promoSection: {
    heading: 'Exclusive Offers for You!',
    claimLabel: 'Claim Offer Now',
    closingHeading: 'Your Beauty Journey Starts Here.',
    closingText: 'Don’t wait to feel your best. Book your appointment with us today!',
    closingCta: 'Book Appointment Now',
  },

  testimonialsSection: {
    heading: 'What Our Clients Say!',
    rateLabel: 'Share Your Experience',
    replyLabel: 'Our Feedback',
    autoApprove: false,
  },

  // Shown when someone opens a link that does not exist (HTTP 404).
  notFound: {
    heading: 'We couldn’t find that page',
    message: 'The page you are looking for may have moved, or the link may have been mistyped. Let’s get you back to feeling your best.',
    image: '/resources/serv8.jpeg',
    homeLabel: 'Back to home',
    bookLabel: 'Book an appointment',
    linksHeading: 'Popular pages',
    helpText: 'Need a hand?',
  },

  privacy: {
    heading: 'Our Privacy Policy',
    effective: 'Jan 7th, 2025',
    body: `At Elixir Salon & Spa, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information when you interact with our website, services, and facilities.

## 1. Information We Collect
We collect the following types of information:
- **Personal Information:** name, email address, phone number, and billing details when you book appointments or contact us.
- **Usage Information:** IP address, browser type, operating system, and browsing behavior through cookies and tracking technologies (e.g., Google Analytics, Facebook Pixel).
- **Device Information:** device type, screen resolution, and geographic location (if shared).

## 2. How We Use Your Data
We use the collected data to:
- Process bookings and provide personalized services.
- Communicate updates, promotions, and confirmations related to your appointments.
- Enhance our website and customer experience.
- Comply with legal requirements or resolve disputes.
- Respond to your inquiries or requests.

## 3. Sharing Your Data
We respect your privacy and do not sell or share your personal information with third parties, except:
- With **trusted partners** necessary to process your bookings (e.g., payment processors).
- If **required by law** or to **protect** our rights and safety.
- We do not sell, rent, or trade your personal data with third parties for their own purposes.

## 4. Data Security
We implement robust security measures to protect your information from unauthorized access or disclosure. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.

## 5. Your Rights
You have the right to:
- Access, update, or delete your personal information.
- Opt out of marketing communications at any time.
- Request clarification on how we handle your data.
- To exercise these rights, contact us at **info@elixirsalonandspa.co.ke**.

## 6. Cookies and Tracking
We use cookies to improve your experience on our website, analyze traffic, and provide targeted promotions. You can manage your cookie preferences through your browser settings.

## 7. Changes to This Policy
We may update this Privacy Policy from time to time to reflect changes in our practices or for legal reasons. The latest version will always be available on our website.

## 8. Contact Us
For questions or concerns about this Privacy Policy or your data, contact us at:
- **Phone:** 0717 733 000
- **Email:** info@elixirsalonandspa.co.ke or elixirsalonandspa25@gmail.com`,
  },

  email: {
    // Booking confirmations, reminders and replies to forms are sent FROM info@ (the mailbox in .env);
    // when a client hits "Reply" it goes to the address below.
    notifyTo: 'admin@elixirsalonandspa.co.ke',
    replyTo: 'admin@elixirsalonandspa.co.ke',
    fromName: 'Elixir Salon & Spa',
    address: 'Commodore Office Suites, Kindaruma Road, Nairobi County',
    contactSubject: 'Welcome to Elixir Salon & Spa - Pamper, Relax, Renew',
    contactBody:
      'Hi {{name}},\n\nThank you for contacting us at Elixir Salon & Spa! We’ve received your message and will get back to you within 24 hours. Your inquiries and feedback are important to us, and we’re here to assist you.\n\nWe’re here to take the complexity out of beauty for you; by pampering, relaxing and renewing yourself.\n\nWe’re excited to connect with you soon!',
    applicationSubject: 'Job Application Receipt',
    applicationBody:
      'Hello {{name}},\n\nThank you for your interest in employment at Elixir Salon & Spa! We are excited to meet you.\n\nOur team will review your application and if there is a strong alignment with the position, we will schedule a call to get to know you better and to answer any questions you have about Elixir Salon & Spa and the role.\n\nWe know that putting together a resume and application is a lot of work. We will give each a thoughtful consideration. We appreciate your patience through this process.\n\nShould you have any questions, do not hesitate to contact us!',
    // ---- Booking emails ({{name}}, {{reference}}, {{date}}, {{time}}, {{services}} are filled in automatically) ----
    bookingConfirmedSubject: 'Your booking is confirmed – {{reference}}',
    bookingConfirmedBody: 'Hi {{name}},\n\nThank you for booking with Elixir Salon & Spa. Your appointment is confirmed and we cannot wait to pamper you.\n\nPlease arrive 5 to 10 minutes early. If your plans change, you can reschedule or cancel using the button below.',
    bookingPendingSubject: 'We have received your booking request – {{reference}}',
    bookingPendingBody: 'Hi {{name}},\n\nThank you for choosing Elixir Salon & Spa. We have received your request and our team will confirm it shortly. You will get another email as soon as it is confirmed.',
    bookingUpdatedSubject: 'Your booking has been updated – {{reference}}',
    bookingUpdatedBody: 'Hi {{name}},\n\nYour appointment has been updated. Here are the new details.',
    bookingCancelledSubject: 'Your booking has been cancelled – {{reference}}',
    bookingCancelledBody: 'Hi {{name}},\n\nYour appointment has been cancelled. We would love to see you soon – you can book a new time whenever suits you.',
    bookingDeclinedSubject: 'About your booking request – {{reference}}',
    bookingDeclinedBody: 'Hi {{name}},\n\nUnfortunately we are not able to accommodate that appointment time. Please choose another time and we will gladly look after you.',
    bookingReminderSubject: 'Reminder: your appointment on {{date}} at {{time}}',
    bookingReminderBody: 'Hi {{name}},\n\nA friendly reminder of your upcoming visit to Elixir Salon & Spa. We look forward to seeing you!',
  },

  scheduling: {
    enabled: true,
    timezone: 'Africa/Nairobi',
    // 0 = Sunday … 6 = Saturday. Times are 24-hour.
    hours: [
      { day: 1, name: 'Monday', open: true, from: '09:00', to: '20:00' },
      { day: 2, name: 'Tuesday', open: true, from: '07:30', to: '20:00' },
      { day: 3, name: 'Wednesday', open: true, from: '07:30', to: '20:00' },
      { day: 4, name: 'Thursday', open: true, from: '07:30', to: '20:00' },
      { day: 5, name: 'Friday', open: true, from: '07:30', to: '20:00' },
      { day: 6, name: 'Saturday', open: true, from: '08:00', to: '20:00' },
      { day: 0, name: 'Sunday', open: true, from: '09:00', to: '17:00' },
    ],
    slotMinutes: 30,
    leadHours: 2,
    advanceDays: 60,
    bufferMinutes: 0,
    autoConfirm: true,
    cancelHours: 12,
    maxActive: 3,
    maxServices: 6,
    requireEmail: true,
    reminderHours: 24,
  },

  bookingUi: {
    title: 'Book your appointment',
    stepServices: 'Choose your services',
    stepTime: 'Pick a date and time',
    stepDetails: 'Your details',
    introServices: 'Select one or more services. You can see the duration and price of each.',
    introTime: 'Choose a day, then a time that suits you.',
    introDetails: 'Nearly there. Tell us who is coming and we will confirm your appointment.',
    confirmLabel: 'Confirm booking',
    requestLabel: 'Request booking',
    successTitle: 'You are booked in',
    successPendingTitle: 'Request received',
    successText: 'A confirmation has been sent to your email. We look forward to welcoming you.',
    successPendingText: 'Our team will confirm your appointment shortly. We will email you as soon as it is confirmed.',
    policy: 'You can reschedule or cancel free of charge up to 12 hours before your appointment. Prices shown are estimates; the final price is confirmed at the salon.',
    consent: 'I agree to the privacy policy and booking policy.',
    quickLabel: 'Book in under a minute',
    quickPlaceholder: 'Choose a service',
    quickButton: 'Find a time',
    stepsHeading: 'Booking made simple',
    steps: [
      { icon: 'hand-pointer', title: 'Choose a service', text: 'Pick what you need from our price list. Combine services in a single visit.' },
      { icon: 'calendar-check', title: 'Select a time', text: 'See live availability and reserve the slot that fits your day.' },
      { icon: 'envelope-circle-check', title: 'Get confirmation', text: 'Instant confirmation by email with a calendar invite and reminder.' },
    ],
  },
};

// [name, price text, duration in minutes] – durations are sensible starting points, editable in the admin.
const categories = [
  {
    name: 'Waxing', imageA: '/resources/serv3.jpeg', imageB: '/resources/serv4.jpeg',
    items: [
      ['Full Body Waxing', '6,000', 120], ['Brazillian', '2,000', 45], ['Bikini', '1,500', 30], ['Under Arm', '800', 15],
      ['Full Leg', '2,000', 45], ['Half Leg', '1,500', 30], ['Facial Waxing', '1,500', 20], ['Chin Waxing', '500', 10],
      ['Chest Waxing', '1,000', 30], ['Eyebrows', '500', 15],
    ],
  },
  {
    name: 'Body Scrub', imageA: '/resources/serve7.jpeg', imageB: '/resources/serve2.jpeg',
    items: [
      ['Salt Scrub', '4,000', 60], ['Caffe Scrub', '4,000', 60], ['Coconut Scrub', '4,000', 60],
      ['Moroccan Scrub', '5,000', 75], ['Cocktail Scrub', '4,500', 60], ['Glows Scrub', '1,500', 30],
    ],
  },
  {
    name: 'Hair Services', imageA: '/resources/serv8.jpeg', imageB: '/resources/serv9.jpeg',
    items: [
      ['Braiding', '10,000', 240], ['Natural Hairstyles', '3,000 - 7,000', 120], ['Dreadlock Retwist', '1,500 - 4,000', 90],
      ['Temporary Locks', '6,000 - 12,000', 240], ['Sister Locks', '20,000 - 40,000', 480], ['Sister Locks Retwist', '5,000', 150],
      ['Finger Coils/Purods', '2,500 - 3,500', 90], ['Hair Color', '2,500 - 7,500', 120], ['Undoing', '500 - 8,000', 90],
      ['Sew-In', '3,500 - 5,500', 120],
    ],
  },
  {
    name: 'Make-up & Lashes', imageA: '/resources/serv10.jpeg', imageB: '/resources/serv11.jpg',
    items: [
      ['Own Make-up', '1,500', 45], ['Salon Make-up', '3,000', 60], ['Touch Up', '1,000', 30],
      ['Subtle/Natural Lashes', '4,000', 90], ['Classic Lashes', '4,500', 105], ['Hybrid Lashes', '5,000', 120],
      ['Volume Lashes', '5,000', 135], ['Mega Volume Lashes', '5,500', 150], ['Lashes Refill', '1,500', 60],
      ['Lashes Removal', '1,500', 30],
    ],
  },
  {
    name: 'Eyebrows', imageA: '/resources/serv12.jpg', imageB: '/resources/serve13.jpg',
    items: [
      ['Microblading', '10,000', 150], ['Ombre Shading', '10,000', 150], ['Touch Up Microblading', '5,000', 90],
      ['Permanent Eyeliner', '1,000', 45], ['Eyebrows Tinting', '400', 20], ['Eyebrows Tweezing', '200', 15],
      ['Threading', '', 15], ['Razor Blows Shaping', '', 20],
    ],
  },
  {
    name: 'Men Services', imageA: '/resources/serv15.jpeg', imageB: '/resources/serve14.jpeg',
    items: [
      ['Haircut', '800', 30], ['Haircut + Beard', '1,000', 45], ['Blowout', '1,000', 30], ['Senior (Above 61 Yrs)', '500', 30],
      ['Hot Towel Shave', '1,000', 30], ['Beard Trim', '400', 20], ['Kid Cut (Below 10 Yrs)', '400', 25],
      ['Above 10 Yrs Age', '500', 30], ['Shampoo', '500 - 1,500', 20],
    ],
  },
  { name: 'Massage', imageA: '/resources/serv1.jpeg', imageB: '/resources/serve2.jpeg', items: [] },
  { name: 'Facials', imageA: '/resources/serve2.jpeg', imageB: '/resources/serv1.jpeg', items: [] },
];

const photos = [
  'serv21.jpeg', 'serv22.jpeg', 'serv23.jpeg', 'serv24.jpeg', 'serv25.jpeg', 'serv26.jpeg', 'serv27.jpeg',
  'serv28.jpeg', 'serv29.jpeg', 'serv31.jpeg', 'serv32.jpeg', 'ser33.jpeg', 'owner.jpeg', 'serv34.jpeg',
  'serv35.jpeg', 'serv36.jpeg', 'serv37.jpeg', 'serv38.jpeg', 'serv39.jpeg', 'serv40.jpeg', 'serve2.jpeg',
  'serv3.jpeg', 'serv4.jpeg', 'serv8.jpeg', 'serv10.jpeg', 'serv15.jpeg', 'home-back-photo.jpeg',
  'home-back-photo1.jpeg', 'serv11.jpg', 'serv12.jpg', 'serv9.jpeg', 'serve7.jpeg',
].map((f) => '/resources/' + f);

const videos = Array.from({ length: 17 }, (_, i) => `/resources/vid${i + 1}.mp4`);

const promotions = [
  { icon: 'gift', title: 'Exclusive Offer for New Clients', body: 'Welcome to our services! Enjoy 20% off your first booking. Check your email for details and experience our exceptional aftercare.' },
  { icon: 'cake-candles', title: 'Celebrate Your Special Day with Us', body: 'Book our special package and enjoy 20% off on all our services. Make your day truly unforgettable!' },
  { icon: 'gem', title: 'Loyalty Reward – We Value You', body: 'As a token of our appreciation, enjoy 20% off your next booking. Thank you for choosing us again!' },
  { icon: 'crown', title: 'Seventh Appointment Special – You Deserve It', body: 'Your loyalty matters! Celebrate your 7th appointment with us and enjoy 20% off on all our services. Thank you for being part of our journey!' },
];

const jobs = [
  { title: 'Hair Stylists' },
  { title: 'Beauty Therapists' },
  { title: 'Receptionists' },
];

const testimonials = [
  ['Mark W.', 'Customer', 'I’ve never felt so pampered before. The spa treatments at Elixir are out of this world!', 4, 'Thank you, Mark, for your glowing review. Your satisfaction means everything to us.'],
  ['Sophie L.', 'Customer', 'Everything was perfect, from the warm welcome to the calming music during the session.', 5, 'Thank you, Sophie, for sharing your experience. We look forward to welcoming you back!'],
  ['David M.', 'Customer', 'Amazing place with great attention to detail. Highly recommend the aromatherapy package.', 5, 'David, thank you for your 5-star rating and recommendation. We’re so glad you enjoyed it!'],
  ['Millie K.', 'Customer', 'The perfect place to relax and unwind. Highly recommend their massage packages.', 5, 'Thank you Millie for your 5 star rating. We are happy to serve.'],
  ['Mary N.', 'Customer', 'The perfect place to relax and unwind. Highly recommend their massage packages.', 5, 'Thank you Mary for your 5 star rating. We are happy to serve.'],
  ['Anita K.', 'Customer', 'The staff is incredibly professional, and the ambiance is serene. A hidden gem!', 5, 'We appreciate your kind words, Anita. Thank you for choosing us for your relaxation.'],
  ['James O.', 'Agent', 'Outstanding service and a truly rejuvenating experience. I’ll be back for sure.', 4, 'Thank you, James, for your wonderful feedback. We’re thrilled you enjoyed your time with us!'],
];

module.exports = { settings, categories, photos, videos, promotions, jobs, testimonials };
