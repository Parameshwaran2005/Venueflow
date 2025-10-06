/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// --- CONFIGURATION ---
const API_BASE_URL = 'http://localhost:3001';
// IMPORTANT: Replace with your actual Gemini API key.
// You can get one for free from Google AI Studio: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyCp6fQV3-SPDWUHvXXoRsYuQRPBBnp4cj4';

const VENUES_CONFIG = {
  auditorium: {
    id: 'auditorium', name: 'Grand Auditorium', features: ['seating', 'av', 'ac', 'refreshments'], capacity: 500, basePrice: 15000,
    options: { 
      seating: ['VIP', 'Audience', 'Stage-side'], 
      av: ['Projector', 'Sound System', 'Lighting'], 
      refreshments: ['Tea/Coffee & Cookies', 'Lunch Buffet', 'High Tea'] 
    }
  },
  ramanujan: {
    id: 'ramanujan', name: 'Ramanujan Hall', features: ['seating', 'refreshments', 'av'], capacity: 200, basePrice: 18000,
    options: { 
      seating: ['Guest Special Seating'], 
      av: ['Audio-Video System'], 
      refreshments: ['Tea/Coffee', 'Snacks'] 
    }
  },
  impactGreens: {
    id: 'impactGreens', name: 'Impact Greens (Lawn)', features: ['seating', 'av'], capacity: 1000, basePrice: 112000,
    options: { 
      seating: ['Guest-Only', 'Guest + Audience'], 
      av: ['Audio-Visual System'] 
    }
  },
  bus: {
    id: 'bus', name: 'Bus Facility', features: ['transport'], options: {}
  },
};

// --- MOCK DATA FALLBACK ---
const FALLBACK_USERS = [
    { "id": "admin01", "email": "admin@venueflow.com", "password": "adminpassword", "name": "Admin", "role": "admin" },
    { "id": "user01", "email": "alex@venueflow.com", "password": "userpassword", "name": "Alex", "role": "user" }
];
const FALLBACK_BOOKINGS = [
    { "id": 1, "userId": "user01", "venueId": "auditorium", "bookingDateTime": "2025-11-15T14:30", "endTime": "2025-11-15T16:30", "details": { "seating": "VIP", "av": "Projector", "ac": "Yes", "refreshments": "Lunch Buffet for 50 members" }, "status": "confirmed", "bookedBy": "Alex" }
];

// --- HELPER & UI COMPONENTS ---

const Icon = ({ path, className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const GlassCard = ({ children, className = "" }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const PrimaryButton = ({ children, onClick, className = "", disabled = false, isLoading = false }) => (
  <button onClick={onClick} disabled={disabled || isLoading} className={`w-full bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center ${className}`}>
    {isLoading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : children}
  </button>
);

const InputField = ({ label, type = 'text', value, onChange, placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300" />
    </div>
);

const formatDateTimeRange = (startISO, endISO) => {
    if (!startISO) return 'No date specified';
    const startDate = new Date(startISO);
    const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
    const datePart = startDate.toLocaleDateString(undefined, optionsDate);
    const optionsTime = { hour: 'numeric', minute: 'numeric', hour12: true };
    const startTimePart = startDate.toLocaleTimeString('en-US', optionsTime);
    if (!endISO) return `${datePart}, ${startTimePart}`;
    const endDate = new Date(endISO);
    const endTimePart = endDate.toLocaleTimeString('en-US', optionsTime);
    return `${datePart}, ${startTimePart} - ${endTimePart}`;
};

// --- MODAL COMPONENT ---

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <GlassCard className="p-6 md:p-8 animate-fade-in-up relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><Icon path="M6 18L18 6M6 6l12 12" /></button>
          {children}
        </GlassCard>
      </div>
    </div>
  );
};

// --- BOOKING FORM COMPONENT ---

const BookingForm = ({ venueId, onBook, date, user, initialDetails = {} }) => {
    const venue = VENUES_CONFIG[venueId];
    const [details, setDetails] = useState(initialDetails);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:00');
    const [members, setMembers] = useState(initialDetails.refreshments?.match(/\d+/)?.[0] || 10);
    const [customRefreshment, setCustomRefreshment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const handleDetailChange = (key, value) => setDetails(prev => ({...prev, [key]: value}));
    const handleSubmit = async () => {
        setIsLoading(true);
        let finalDetails = {...details};
        if(venue.features.includes('refreshments')) {
            const refreshmentChoice = details.refreshments === 'Custom' ? customRefreshment : details.refreshments;
            finalDetails.refreshments = `${refreshmentChoice || venue.options.refreshments[0]} for ${members} members`;
        }
        await onBook({ venueId: venue.id, bookingDateTime: `${date}T${startTime}`, endTime: `${date}T${endTime}`, details: finalDetails, bookedBy: user.name, userId: user.id });
        setIsLoading(false);
    };
    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white">Book: {venue.name}</h3>
            <div className="grid grid-cols-3 gap-4">
                <InputField label="Date" type="text" value={date} onChange={() => {}} disabled />
                <InputField label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                <InputField label="End Time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
            {venue.features.includes('seating') && (<div><label className="block text-sm font-medium text-gray-300 mb-1">Seating Arrangement</label><select value={details.seating} onChange={(e) => handleDetailChange('seating', e.target.value)} className="w-full p-2 bg-white/5 border border-white/20 rounded-lg text-white">{venue.options.seating.map(opt => <option className="bg-gray-800 text-white" key={opt}>{opt}</option>)}</select></div>)}
            {venue.features.includes('av') && (<div><label className="block text-sm font-medium text-gray-300 mb-1">Audio-Visual</label><select value={details.av} onChange={(e) => handleDetailChange('av', e.target.value)} className="w-full p-2 bg-white/5 border border-white/20 rounded-lg text-white">{venue.options.av.map(opt => <option className="bg-gray-800 text-white" key={opt}>{opt}</option>)}</select></div>)}
            {venue.features.includes('ac') && (<div><label className="block text-sm font-medium text-gray-300 mb-1">AC Required</label><select value={details.ac || 'No'} onChange={(e) => handleDetailChange('ac', e.target.value)} className="w-full p-2 bg-white/5 border border-white/20 rounded-lg text-white"><option className="bg-gray-800 text-white">No</option><option className="bg-gray-800 text-white">Yes</option></select></div>)}
            {venue.features.includes('refreshments') && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Refreshments</label>
                    <select value={details.refreshments} onChange={e => handleDetailChange('refreshments', e.target.value)} className="w-full p-2 bg-white/5 border border-white/20 rounded-lg mb-2 text-white">
                        {venue.options.refreshments.map(opt => <option className="bg-gray-800 text-white" key={opt}>{opt}</option>)}
                        <option className="bg-gray-800 text-white">Custom</option>
                    </select>
                    {details.refreshments === 'Custom' && <InputField label="Custom Refreshment" value={customRefreshment} onChange={e => setCustomRefreshment(e.target.value)} placeholder="e.g., Vegan snacks" />}
                    <InputField label="Number of Members" type="number" value={members} onChange={e => setMembers(e.target.value)} />
                </div>
            )}
            {venue.features.includes('transport') && <InputField label="Transport Needs" value={details.transport || ''} onChange={e => handleDetailChange('transport', e.target.value)} placeholder="e.g., Round trip for 50 people" />}
            <PrimaryButton onClick={handleSubmit} isLoading={isLoading}>Submit Booking Request</PrimaryButton>
        </div>
    );
};

// --- CORE VIEW COMPONENTS ---

const LandingPage = ({ onGetStarted }) => {
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
            .float-1 { animation: float 6s ease-in-out infinite; }
            .float-2 { animation: float 7s ease-in-out infinite; animation-delay: 1s; }
            .float-3 { animation: float 8s ease-in-out infinite; animation-delay: 0.5s; }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    return (
        <div className="h-screen w-screen relative flex flex-col justify-center items-center overflow-hidden bg-[#0a0a2a] text-white">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-transparent to-blue-900/30"></div>
            <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
                <h2 className="text-2xl font-bold tracking-widest uppercase">VenueFlow</h2>
                <div>
                    <button className="mr-4 text-gray-300 hover:text-white transition-colors">Home</button>
                    <button onClick={onGetStarted} className="bg-cyan-500/80 text-white font-semibold py-2 px-5 rounded-lg hover:bg-cyan-500 transition-colors">Login</button>
                </div>
            </nav>
            <main className="relative z-10 grid md:grid-cols-2 gap-8 items-center max-w-7xl mx-auto px-8">
                <div className="text-center md:text-left animate-fade-in-up">
                    <h1 className="text-5xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Premium Venue</h1>
                    <h1 className="text-5xl lg:text-7xl font-extrabold mt-2 text-white">Booking Made Simple.</h1>
                    <p className="mt-6 text-lg text-gray-400 max-w-lg mx-auto md:mx-0">Book auditoriums, halls, lawns, and transport facilities with our cutting-edge platform.</p>
                    <div className="mt-8 flex gap-4 justify-center md:justify-start">
                        <button onClick={onGetStarted} className="bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-cyan-600 transition-transform transform hover:scale-105">Get Started</button>
                    </div>
                </div>
                <div className="relative hidden md:block animate-fade-in-up animation-delay-300">
                    <div className="absolute top-10 right-10 float-1">
                        <GlassCard className="p-4 w-60">
                            <h3 className="font-bold text-lg text-cyan-400">Auditorium</h3>
                            <p className="text-sm text-gray-300">{VENUES_CONFIG.auditorium.capacity} capacity</p>
                        </GlassCard>
                    </div>
                     <div className="absolute top-40 left-0 float-2">
                         <GlassCard className="p-4 w-60">
                            <h3 className="font-bold text-lg text-cyan-400">Ramanujan Hall</h3>
                            <p className="text-sm text-gray-300">{VENUES_CONFIG.ramanujan.capacity} capacity</p>
                        </GlassCard>
                    </div>
                     <div className="absolute top-80 right-20 float-3">
                         <GlassCard className="p-4 w-60">
                            <h3 className="font-bold text-lg text-cyan-400">Impact Greens</h3>
                            <p className="text-sm text-gray-300">{VENUES_CONFIG.impactGreens.capacity} capacity</p>
                        </GlassCard>
                    </div>
                </div>
            </main>
        </div>
    );
};

const LoginPage = ({ onLogin, onSignUp, onBack }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const handleAuthAction = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        let authError;
        if (isLoginView) {
            authError = await onLogin(email, password);
        } else {
            authError = await onSignUp(name, email, password);
        }
        if (authError) {
            setError(authError);
        }
        setIsLoading(false);
    };
    return (
        <div className="w-full max-w-md mx-auto animate-fade-in-up">
            <GlassCard className="p-8 relative">
                <button onClick={onBack} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><Icon path="M6 18L18 6M6 6l12 12" /></button>
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-bold text-white tracking-wider">VenueFlow</h2>
                    <p className="text-gray-300 mt-2">Smart venues. Perfect moments.</p>
                </div>
                {error && <p className="bg-red-500/30 text-red-300 text-center p-3 rounded-lg mb-6">{error}</p>}
                <form onSubmit={handleAuthAction} className="space-y-6">
                    {!isLoginView && <InputField label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />}
                     <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3"><Icon path="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" className="w-5 h-5 text-gray-400" /></span>
                        <input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300" required />
                    </div>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3"><Icon path="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" className="w-5 h-5 text-gray-400" /></span>
                        <input type={isPasswordVisible ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300" required />
                        <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white">
                            <Icon path={isPasswordVisible ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"} className="w-5 h-5" />
                        </button>
                    </div>
                    <PrimaryButton type="submit" isLoading={isLoading}>{isLoginView ? 'Sign In' : 'Sign Up'}</PrimaryButton>
                </form>
                <div className="text-center text-gray-300 text-sm mt-6">
                    <button onClick={() => setIsLoginView(!isLoginView)} className="hover:text-white hover:underline">
                        {isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                    </button>
                 </div>
            </GlassCard>
        </div>
    );
};

const CalendarView = ({ bookings, onDayClick, displayDate, setDisplayDate }) => {
    const calendarDays = useMemo(() => {
        const startOfMonth = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1);
        const endOfMonth = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0);
        const daysInMonth = endOfMonth.getDate();
        const startDayOfWeek = startOfMonth.getDay();
        let days = [];
        for (let i = 0; i < startDayOfWeek; i++) { days.push({ key: `empty-${i}`, empty: true }); }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(displayDate.getFullYear(), displayDate.getMonth(), day));
            const dateStr = date.toISOString().split('T')[0];
            const dayBookings = bookings.filter(b => b && b.bookingDateTime && b.bookingDateTime.startsWith(dateStr));
            days.push({ key: `day-${day}`, day, date: dateStr, bookings: dayBookings });
        }
        return days;
    }, [displayDate, bookings]);

    const changeMonth = (offset) => {
        setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const getStatusColor = (status) => ({ 'confirmed': 'bg-green-500/50 border-green-400', 'pending': 'bg-yellow-500/50 border-yellow-400', 'completed': 'bg-blue-500/50 border-blue-400', 'rejected': 'bg-red-500/50 border-red-400' }[status] || 'bg-gray-500/50');

    return (
        <GlassCard className="w-full p-6">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-white/10"><Icon path="M15.75 19.5L8.25 12l7.5-7.5" /></button>
                <h3 className="text-xl font-bold text-white">{displayDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-white/10"><Icon path="M8.25 4.5l7.5 7.5-7.5 7.5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-gray-300 text-sm font-semibold">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day}>{day}</div>)}</div>
            <div className="grid grid-cols-7 gap-1 md:gap-2 mt-2">
                {calendarDays.map(dayInfo => (
                    <div key={dayInfo.key} className={`h-28 md:h-36 rounded-lg p-2 flex flex-col cursor-pointer transition-colors hover:bg-white/10 ${dayInfo.empty ? 'bg-transparent' : 'bg-white/5'}`} onClick={() => !dayInfo.empty && onDayClick(dayInfo.date)}>
                        {!dayInfo.empty && (<><span className="font-bold text-white">{dayInfo.day}</span><div className="mt-1 space-y-1 overflow-y-auto text-xs hide-scrollbar">{dayInfo.bookings.map(b => (<div key={b.id} className={`p-1.5 rounded border-l-2 text-left text-white/90 ${getStatusColor(b.status)}`}><span className="font-semibold">{VENUES_CONFIG[b.venueId]?.name?.split(' ')[0]}</span> - {b.bookedBy}</div>))}</div></>)}
                    </div>
                ))}
            </div>
        </GlassCard>
    );
};

const DashboardPage = ({ user, onLogout, bookings, onAddBooking, onUpdateBookingStatus, onCancelBooking }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingDate, setBookingDate] = useState(null);
    const [selectedVenue, setSelectedVenue] = useState(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [displayDate, setDisplayDate] = useState(new Date());

    const handleDayClick = (date) => { 
        setBookingDate(date); 
        setIsModalOpen(true); 
    };
    
    const handleBooking = (bookingData) => { 
        onAddBooking(bookingData); 
        closeModal(); 
    };
    
    const closeModal = () => { 
        setIsModalOpen(false); 
        setSelectedVenue(null);
    };

    const handleSummarizeClick = async (booking) => {
        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            alert("Please set your Gemini API key to use the summarize feature.");
            return;
        }
        setIsSummaryLoading(true);
        setIsSummaryModalOpen(true);
        setSummaryContent('');
        const prompt = `Summarize the following booking details in a friendly, concise paragraph. Convert all details into a natural sentence. Booking made by: ${booking.bookedBy}. Venue: ${VENUES_CONFIG[booking.venueId].name}. Date and Time: ${formatDateTimeRange(booking.bookingDateTime, booking.endTime)}. Status: ${booking.status}. Other details: ${JSON.stringify(booking.details)}.`;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        try {
             const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error('Gemini API request failed');
            const result = await response.json();
            setSummaryContent(result.candidates[0].content.parts[0].text);
        } catch (error) {
            console.error("Failed to get summary:", error);
            setSummaryContent("Sorry, I couldn't generate a summary for this booking.");
        } finally {
            setIsSummaryLoading(false);
        }
    };
    
    const handleMonthChange = (e) => {
        const newMonth = parseInt(e.target.value);
        setDisplayDate(new Date(displayDate.getFullYear(), newMonth, 1));
    };

    const handleYearChange = (e) => {
        const newYear = parseInt(e.target.value);
        setDisplayDate(new Date(newYear, displayDate.getMonth(), 1));
    };

    const myBookings = bookings.filter(b => b && b.userId === user.id);
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1, currentYear + 2];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="w-full max-w-7xl mx-auto px-4 animate-fade-in-up">
            <header className="flex flex-wrap justify-between items-center py-4 mb-8 pb-6 border-b border-white/10">
                <div>
                    <h2 className="text-4xl font-bold text-white" style={{textShadow: '0 0 25px rgba(139, 92, 246, 0.9)'}}>VenueFlow Dashboard</h2>
                    <p className="text-gray-100 mt-1">Welcome, <span className="font-bold text-indigo-300">{user.name} ({user.role})</span></p>
                </div>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <button onClick={onLogout} title="Logout" className="p-2 text-gray-300 hover:text-white transition-colors rounded-full hover:bg-white/10"><Icon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></button>
                </div>
            </header>
            <main className="space-y-8 animate-fade-in-up" style={{animationDelay: '200ms'}}>
                <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-semibold text-white tracking-wide">Booking Calendar</h3>
                    <div className="flex gap-2">
                        <select value={displayDate.getMonth()} onChange={handleMonthChange} className="bg-white/10 border border-white/20 rounded-lg text-white p-2">
                            {months.map((month, index) => <option key={month} value={index} className="bg-gray-800">{month}</option>)}
                        </select>
                        <select value={displayDate.getFullYear()} onChange={handleYearChange} className="bg-white/10 border border-white/20 rounded-lg text-white p-2">
                            {years.map(year => <option key={year} value={year} className="bg-gray-800">{year}</option>)}
                        </select>
                    </div>
                </div>

                <CalendarView bookings={bookings} onDayClick={handleDayClick} displayDate={displayDate} setDisplayDate={setDisplayDate} />

                <div className="animate-fade-in-up" style={{animationDelay: '400ms'}}>
                    {user.role === 'user' ? (<UserBookingsView bookings={myBookings} onCancelBooking={onCancelBooking} onSummarize={handleSummarizeClick} />) : (<AdminBookingsView allBookings={bookings} onStatusChange={onUpdateBookingStatus} onSummarize={handleSummarizeClick}/>)}
                </div>
            </main>
            <Modal isOpen={isModalOpen} onClose={closeModal}>
                 {!selectedVenue ? (
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-4">Select a Venue to Book on {bookingDate}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Object.values(VENUES_CONFIG).map(venue => (<div key={venue.id} onClick={() => setSelectedVenue(venue.id)} className="p-4 bg-white/10 rounded-lg cursor-pointer hover:bg-indigo-500/50 transition-colors"><h4 className="font-bold text-lg">{venue.name}</h4></div>))}</div>
                    </div>
                ) : ( <BookingForm venueId={selectedVenue} onBook={handleBooking} date={bookingDate} user={user} /> )}
            </Modal>
             <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)}>
                <h3 className="text-2xl font-bold text-white mb-4">✨ Booking Summary</h3>
                {isSummaryLoading ? (<div className="flex justify-center items-center h-24"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>) : (<p className="text-gray-300 whitespace-pre-wrap">{summaryContent}</p>)}
            </Modal>
        </div>
    );
};

const UserBookingsView = ({ bookings, onCancelBooking, onSummarize }) => (
    <div>
        <h3 className="text-2xl font-semibold text-white tracking-wide mt-12 mb-4">My Bookings</h3>
        <GlassCard className="p-6">{bookings.length > 0 ? (<ul className="space-y-4">{bookings.map(b => (<li key={b.id} className="flex flex-wrap justify-between items-center bg-white/5 p-4 rounded-lg"><div><p className="font-bold text-lg">{VENUES_CONFIG[b.venueId]?.name || 'Unknown Venue'}</p><p className="text-sm text-gray-300">{formatDateTimeRange(b.bookingDateTime, b.endTime)}</p></div><div className="flex items-center gap-4 mt-2 md:mt-0"><button onClick={() => onSummarize(b)} className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm">✨ Summarize</button><span className={`px-3 py-1 text-sm font-semibold rounded-full ${b.status === 'confirmed' ? 'bg-green-500/20 text-green-300' : b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>{b.status}</span><button onClick={() => onCancelBooking(b.id)} className="text-red-400 hover:text-red-300 font-semibold">Cancel</button></div></li>))}</ul>) : <p className="text-gray-400">You have no upcoming bookings.</p>}</GlassCard>
    </div>
);

const AdminBookingsView = ({ allBookings, onStatusChange, onSummarize }) => (
    <div>
        <h3 className="text-2xl font-semibold text-white tracking-wide mt-12 mb-4">Admin Panel: All Bookings</h3>
        <GlassCard className="p-6"><div className="space-y-4">{allBookings.map(b => (<div key={b.id} className="grid grid-cols-1 md:grid-cols-5 items-center gap-4 bg-white/5 p-4 rounded-lg"><div><span className="font-bold">{b.bookedBy}</span> <p className="text-sm text-gray-300">({VENUES_CONFIG[b.venueId]?.name || 'Unknown Venue'})</p></div><div className="text-gray-300 md:col-span-2">{formatDateTimeRange(b.bookingDateTime, b.endTime)}</div><div className="font-semibold capitalize">{b.status}</div><div className="flex gap-2 items-center">{b.status === 'pending' && (<><button onClick={() => onStatusChange(b.id, 'confirmed')} className="w-full text-sm bg-green-500/80 hover:bg-green-500 text-white font-bold py-2 px-2 rounded-lg">Confirm</button><button onClick={() => onStatusChange(b.id, 'rejected')} className="w-full text-sm bg-red-500/80 hover:bg-red-500 text-white font-bold py-2 px-2 rounded-lg">Reject</button></>)}<button onClick={() => onSummarize(b)} title="Summarize Booking" className="p-2 text-indigo-400 hover:text-indigo-300">✨</button></div></div>))}</div></GlassCard>
    </div>
);


// --- MAIN APP COMPONENT ---

export default function App() {
  const [appState, setAppState] = useState('landing'); // landing, auth, dashboard
  const [bookings, setBookings] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  // Fetch initial bookings data
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/bookings`);
        if (!response.ok) throw new Error("Backend not reachable");
        const data = await response.json();
        setBookings(data);
        setIsBackendOnline(true);
      } catch (error) {
        console.warn("Could not fetch from backend. Using fallback data. Please ensure json-server is running.");
        setBookings(FALLBACK_BOOKINGS);
        setIsBackendOnline(false);
      }
    };
    if (appState === 'dashboard') {
        fetchBookings();
    }
  }, [appState]);

  const handleLogin = useCallback(async (email, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/users?email=${email.toLowerCase()}`);
        if (!response.ok) throw new Error("Backend not reachable");
        const users = await response.json();
        const user = users[0];
        if (user && user.password === password) {
          setCurrentUser(user);
          setAppState('dashboard');
          return null;
        }
        return 'Invalid email or password.';
    } catch(error) {
        console.warn("Login fetch failed. Using fallback users.");
        const user = FALLBACK_USERS.find(u => u.email === email.toLowerCase() && u.password === password);
        if (user) {
            setCurrentUser(user);
            setAppState('dashboard');
            return null;
        }
        return 'Invalid email or password.';
    }
  }, []);

  const handleSignUp = useCallback(async (name, email, password) => {
    try {
        if (!isBackendOnline) {
             return "Cannot sign up while offline. Please start the backend server.";
        }
        const checkResponse = await fetch(`${API_BASE_URL}/users?email=${email.toLowerCase()}`);
        if (!checkResponse.ok) throw new Error('Failed to check for existing user.');
        const existingUsers = await checkResponse.json();
        if (existingUsers.length > 0) {
            return 'An account with this email already exists.';
        }
        const newUser = { id: 'user_' + Date.now(), name, email: email.toLowerCase(), password, role: 'user' };
        const createResponse = await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
        if (!createResponse.ok) throw new Error('Server failed to create user.');
        const createdUser = await createResponse.json();
        setCurrentUser(createdUser);
        setAppState('dashboard');
        return null;
    } catch(error) {
        console.error("Sign up failed:", error);
        return 'An error occurred during sign up.';
    }
  }, [isBackendOnline]);

  const handleLogout = useCallback(() => {
      setCurrentUser(null);
      setAppState('landing');
  }, []);

  const handleAddBooking = async (bookingData) => {
      if (!isBackendOnline) {
          alert("Cannot add booking while offline.");
          return;
      }
      try {
        const newBooking = { ...bookingData, status: 'pending' };
        const response = await fetch(`${API_BASE_URL}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newBooking) });
        const savedBooking = await response.json();
        setBookings(prev => [...prev, savedBooking]);
      } catch (error) {
          console.error("Failed to add booking:", error);
      }
  };

  const handleUpdateBookingStatus = async (id, status) => {
    if (!isBackendOnline) {
          alert("Cannot update status while offline.");
          return;
      }
    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        const updatedBooking = await response.json();
        setBookings(prev => prev.map(b => b.id === id ? updatedBooking : b));
    } catch (error) {
        console.error("Failed to update status:", error);
    }
  };

  const handleCancelBooking = async (id) => {
      if (!isBackendOnline) {
          alert("Cannot cancel booking while offline.");
          return;
      }
      try {
          await fetch(`${API_BASE_URL}/bookings/${id}`, { method: 'DELETE' });
          setBookings(prev => prev.filter(b => b.id !== id));
      } catch (error) {
          console.error("Failed to cancel booking:", error);
      }
  };

  const renderContent = () => {
      switch(appState) {
          case 'landing':
              return <LandingPage onGetStarted={() => setAppState('auth')} />;
          case 'auth':
              return (
                <div className="min-h-screen w-full flex items-center justify-center">
                    <LoginPage onLogin={handleLogin} onSignUp={handleSignUp} onBack={() => setAppState('landing')} />
                </div>
              );
          case 'dashboard':
              return <DashboardPage 
                        user={currentUser} 
                        onLogout={handleLogout} 
                        bookings={bookings}
                        onAddBooking={handleAddBooking}
                        onUpdateBookingStatus={handleUpdateBookingStatus}
                        onCancelBooking={handleCancelBooking}
                     />;
          default:
              return <LandingPage onGetStarted={() => setAppState('auth')} />;
      }
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white font-sans relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full animated-gradient-bg z-0"></div>
        <main className="w-full z-10 relative">
            {renderContent()}
        </main>
    </div>
  );
}

