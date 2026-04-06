import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Bed, 
  Bath, 
  Maximize, 
  Sparkles, 
  Send, 
  Building2, 
  Home, 
  Briefcase,
  Loader2,
  ChevronRight,
  Info,
  Paperclip,
  Command,
  User,
  LogOut,
  AlertCircle,
  ShieldCheck,
  Zap,
  Crown,
  Plus,
  LayoutDashboard,
  Users,
  CreditCard,
  CheckCircle2,
  X,
  Settings as SettingsIcon,
  ChevronDown,
  Smartphone,
  Copy
} from 'lucide-react';
import { getPropertyRecommendations, type Recommendation, type AIResponse } from './services/gemini';
import { propertyService, type Property } from './services/propertyService';
import { userService, type UserProfile, Tier, Role } from './services/userService';
import { paymentService, PaymentStatus, type PaymentRequest } from './services/paymentService';
import { chatService, type ChatMessage } from './services/chatService';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User as FirebaseUser } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [history, setHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Recommendation | null>(null);
  const [hasOwnKey, setHasOwnKey] = useState(false);
  const [view, setView] = useState<'chat' | 'pricing' | 'dashboard' | 'admin'>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<{ tier: Tier, price: number } | null>(null);
  const [walletNumber, setWalletNumber] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAdminUser, setSelectedAdminUser] = useState<UserProfile | null>(null);
  const [adminUserChats, setAdminUserChats] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New Property Form State
  const [newProperty, setNewProperty] = useState<Partial<Property>>({
    title: '',
    location: '',
    price: '',
    rooms: 3,
    bathrooms: 2,
    size: '120 sqm',
    features: [],
    type: 'apartment',
    imageUrl: 'https://picsum.photos/seed/new/800/600'
  });

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasOwnKey(hasKey);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        let userProfile = await userService.getProfile(currentUser.uid);
        if (!userProfile) {
          userProfile = await userService.createProfile(
            currentUser.uid, 
            currentUser.email || '', 
            currentUser.displayName || 'User'
          );
        }
        setProfile(userProfile);

        // Subscribe to user's chat history
        const chatUnsubscribe = chatService.subscribeToUserChats(currentUser.uid, (messages) => {
          if (messages.length > 0) {
            setHistory(messages.map(m => ({ role: m.role, content: m.content })));
          }
        });
        return () => chatUnsubscribe();
      } else {
        setProfile(null);
        setHistory([]);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (view === 'admin' && profile?.role === Role.ADMIN) {
      userService.getAllUsers().then(setAllUsers);
      paymentService.getAllPendingPayments().then(setPendingPayments);
    }
  }, [view, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  useEffect(() => {
    // Seed initial data if database is empty and user is admin
    if (isAuthReady && user?.email === 'aamr222382@gmail.com' && user.uid) {
      propertyService.seedInitialData(user.uid);
    }
  }, [isAuthReady, user]);

  useEffect(() => {
    if (selectedAdminUser && profile?.role === Role.ADMIN) {
      const unsubscribe = chatService.subscribeToUserChats(selectedAdminUser.uid, setAdminUserChats);
      return () => unsubscribe();
    }
  }, [selectedAdminUser, profile]);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasOwnKey(true);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    if (user?.uid) {
      chatService.saveMessage(user.uid, 'user', userMessage);
    }
    setHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);
    setError(null);
    
    try {
      // Use the latest history for the API call
      const result = await getPropertyRecommendations(userMessage, history);
      setResponse(result);
      
      let assistantContent = result.message || '';
      if (result.followUpQuestion) {
        assistantContent += (assistantContent ? '\n\n' : '') + result.followUpQuestion;
      }
      
      // Only add the "found properties" text if there are actually recommendations
      if (result.recommendations && result.recommendations.length > 0) {
        const count = result.recommendations.length;
        const text = count === 1 ? "لقيت لك عرض واحد ممتاز:" : `لقيت لك ${count} عروض ممتازة:`;
        assistantContent += (assistantContent ? '\n\n' : '') + text;
      }

      if (user?.uid) {
        chatService.saveMessage(user.uid, 'assistant', assistantContent);
      }
      setHistory(prev => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err: any) {
      console.error("Submission error:", err);
      setError("Something went wrong. Please try again.");
      setHistory(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an unexpected error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (profile.tier === Tier.FREE && profile.role !== Role.ADMIN) {
      alert("This feature requires a higher tier. Please contact support.");
      return;
    }

    setIsUploading(true);
    try {
      // In a real app, we'd use a service to add the doc
      // Here we'll just simulate it or add it to firestore if rules allow
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      
      await addDoc(collection(db, 'properties'), {
        ...newProperty,
        ownerUid: user.uid,
        companyName: profile.displayName,
        createdAt: serverTimestamp()
      });
      
      setNewProperty({
        title: '',
        location: '',
        price: '',
        rooms: 3,
        bathrooms: 2,
        size: '120 sqm',
        features: [],
        type: 'apartment',
        imageUrl: 'https://picsum.photos/seed/new/800/600'
      });
      alert("Property added successfully!");
    } catch (err) {
      console.error("Error adding property:", err);
      alert("Failed to add property. Check your tier permissions.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpgrade = async (uid: string, tier: Tier) => {
    if (profile?.role !== Role.ADMIN) return;
    try {
      await userService.upgradeUser(uid, tier);
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, tier } : u));
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !showPaymentModal) return;
    
    if (!/^010\d{8}$/.test(walletNumber)) {
      alert("Please enter a valid Vodafone Cash number (010xxxxxxxx)");
      return;
    }

    setIsProcessingPayment(true);
    try {
      await paymentService.createPaymentRequest(
        user.uid, 
        showPaymentModal.tier, 
        walletNumber, 
        showPaymentModal.price
      );
      alert("Payment request sent! Please transfer the amount to 01020117504. Your account will be upgraded once verified.");
      setShowPaymentModal(null);
      setWalletNumber('');
    } catch (err) {
      console.error("Payment request error:", err);
      alert("Failed to send payment request.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleVerifyPayment = async (payment: PaymentRequest) => {
    if (profile?.role !== Role.ADMIN) return;
    try {
      await paymentService.verifyPayment(payment.id!);
      await userService.upgradeUser(payment.uid, payment.tier);
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
      alert(`Payment verified! User upgraded to ${payment.tier}`);
    } catch (err) {
      console.error("Verification error:", err);
    }
  };

  const renderPricingView = () => (
    <div className="w-full max-w-5xl mx-auto py-12 px-6">
      <div className="text-center mb-16 space-y-4">
        <h2 className="text-4xl font-black tracking-tight text-white uppercase">Upgrade Your Experience</h2>
        <p className="text-gray-500 max-w-2xl mx-auto">Choose the tier that fits your business. Upload properties and reach thousands of potential buyers with Keywey AI.</p>
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 border border-primary/20 rounded-2xl mt-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-primary">Payment via Vodafone Cash: <span className="text-white">01020117504</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Free Tier */}
        <div className="bg-[#141414] border border-[#262626] rounded-[40px] p-8 flex flex-col">
          <div className="mb-8">
            <div className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Basic</div>
            <h3 className="text-2xl font-bold text-white">Free Tier</h3>
          </div>
          <div className="text-4xl font-black text-white mb-8">0 <span className="text-sm text-gray-600">EGP</span></div>
          <ul className="space-y-4 mb-12 flex-1">
            <li className="flex items-center gap-3 text-sm text-gray-400">
              <CheckCircle2 className="w-5 h-5 text-gray-600" /> AI Property Search
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-400">
              <CheckCircle2 className="w-5 h-5 text-gray-600" /> Market Trends Access
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600 opacity-30">
              <X className="w-5 h-5" /> Property Uploads
            </li>
          </ul>
          <button disabled className="w-full py-4 bg-white/5 border border-white/10 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-widest">Current Plan</button>
        </div>

        {/* Plus Tier */}
        <div className="bg-[#141414] border-2 border-primary rounded-[40px] p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-black px-6 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest">Popular</div>
          <div className="mb-8">
            <div className="text-primary text-xs font-black uppercase tracking-widest mb-2">Advanced</div>
            <h3 className="text-2xl font-bold text-white">Plus Tier</h3>
          </div>
          <div className="text-4xl font-black text-white mb-8">5,000 <span className="text-sm text-gray-600">EGP</span></div>
          <ul className="space-y-4 mb-12 flex-1">
            <li className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-primary" /> Unlimited Property Uploads
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-primary" /> Management Dashboard
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-primary" /> AI Sales Optimization
            </li>
          </ul>
          <div className="space-y-3">
            <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-widest">Send 5,000 to 01020117504</p>
            <button 
              onClick={() => setShowPaymentModal({ tier: Tier.PLUS, price: 5000 })} 
              className="w-full py-4 bg-primary text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Upgrade Now
            </button>
          </div>
        </div>

        {/* Premium Tier */}
        <div className="bg-[#141414] border border-[#262626] rounded-[40px] p-8 flex flex-col">
          <div className="mb-8">
            <div className="text-yellow-500 text-xs font-black uppercase tracking-widest mb-2">Elite</div>
            <h3 className="text-2xl font-bold text-white">Premium Tier</h3>
          </div>
          <div className="text-4xl font-black text-white mb-8">15,000 <span className="text-sm text-gray-600">EGP</span></div>
          <ul className="space-y-4 mb-12 flex-1">
            <li className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-yellow-500" /> Everything in Plus
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-yellow-500" /> Priority AI Placement
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-yellow-500" /> Featured Listings
            </li>
          </ul>
          <div className="space-y-3">
            <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-widest">Send 15,000 to 01020117504</p>
            <button 
              onClick={() => setShowPaymentModal({ tier: Tier.PREMIUM, price: 15000 })} 
              className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboardView = () => (
    <div className="w-full max-w-4xl mx-auto py-12 px-6 space-y-12">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Property Management</h2>
          <p className="text-gray-500 text-sm font-medium">Add and manage your real estate listings</p>
        </div>
        <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">{profile?.tier} Tier</span>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-[40px] p-10">
        <form onSubmit={handleAddProperty} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Property Title</label>
              <input 
                required
                value={newProperty.title}
                onChange={e => setNewProperty(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-6 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                placeholder="e.g. Modern Villa with Pool"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Location</label>
              <input 
                required
                value={newProperty.location}
                onChange={e => setNewProperty(prev => ({ ...prev, location: e.target.value }))}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-6 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                placeholder="e.g. New Cairo, Fifth Settlement"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Price (EGP)</label>
              <input 
                required
                value={newProperty.price}
                onChange={e => setNewProperty(prev => ({ ...prev, price: e.target.value }))}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-6 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                placeholder="e.g. 5,000,000 EGP"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Property Type</label>
              <select 
                value={newProperty.type}
                onChange={e => setNewProperty(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-6 py-4 text-sm focus:border-primary/50 transition-all outline-none appearance-none"
              >
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="studio">Studio</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Rooms</label>
                <input 
                  type="number"
                  value={newProperty.rooms}
                  onChange={e => setNewProperty(prev => ({ ...prev, rooms: parseInt(e.target.value) }))}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-4 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Baths</label>
                <input 
                  type="number"
                  value={newProperty.bathrooms}
                  onChange={e => setNewProperty(prev => ({ ...prev, bathrooms: parseInt(e.target.value) }))}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-4 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Size</label>
                <input 
                  value={newProperty.size}
                  onChange={e => setNewProperty(prev => ({ ...prev, size: e.target.value }))}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-4 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Image URL</label>
              <input 
                value={newProperty.imageUrl}
                onChange={e => setNewProperty(prev => ({ ...prev, imageUrl: e.target.value }))}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-6 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                placeholder="https://..."
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isUploading}
            className="w-full py-5 bg-primary text-black font-black rounded-3xl text-sm uppercase tracking-[0.2em] hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Publish Listing
          </button>
        </form>
      </div>
    </div>
  );

  const renderAdminView = () => (
    <div className="w-full max-w-6xl mx-auto py-12 px-6 space-y-12">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Main Control Panel</h2>
          <p className="text-gray-500 text-sm font-medium">Monitor accounts and manage subscription tiers</p>
        </div>
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-red-500" />
          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">System Admin</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Pending Payments</h3>
          <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
            {pendingPayments.length} Requests
          </span>
        </div>
        
        {pendingPayments.length === 0 ? (
          <div className="bg-[#141414] border border-dashed border-[#262626] rounded-3xl p-12 text-center">
            <p className="text-gray-500 text-sm font-medium">No pending payment requests</p>
          </div>
        ) : (
          pendingPayments.map((p, i) => (
            <div key={i} className="bg-[#141414] border border-primary/20 rounded-3xl p-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Smartphone className="text-primary w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">{p.walletNumber}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {p.tier}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{p.amount.toLocaleString()} EGP • {p.uid.substring(0, 8)}...</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleVerifyPayment(p)}
                  className="px-6 py-3 bg-primary text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
                >
                  Verify & Upgrade
                </button>
                <button 
                  onClick={() => paymentService.rejectPayment(p.id!).then(() => setPendingPayments(prev => prev.filter(req => req.id !== p.id)))}
                  className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}

        <div className="h-px bg-[#262626] my-8" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">User Directory</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {allUsers.map((u, i) => (
              <div key={i} className={cn(
                "bg-[#141414] border rounded-3xl p-6 flex items-center justify-between group transition-all cursor-pointer",
                selectedAdminUser?.uid === u.uid ? "border-primary" : "border-[#262626] hover:border-white/10"
              )} onClick={() => setSelectedAdminUser(u)}>
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-[#0D0D0D] border border-[#262626] rounded-2xl flex items-center justify-center text-primary font-black">
                    {u.displayName[0]}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{u.displayName}</span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                        u.tier === Tier.PREMIUM ? "bg-yellow-500/10 text-yellow-500" :
                        u.tier === Tier.PLUS ? "bg-primary/10 text-primary" : "bg-gray-500/10 text-gray-500"
                      )}>
                        {u.tier}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => handleUpgrade(u.uid, Tier.FREE)}
                    className="px-4 py-2 bg-[#0D0D0D] border border-[#262626] rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all"
                  >
                    Free
                  </button>
                  <button 
                    onClick={() => handleUpgrade(u.uid, Tier.PLUS)}
                    className="px-4 py-2 bg-primary/5 border border-primary/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                  >
                    Plus
                  </button>
                  <button 
                    onClick={() => handleUpgrade(u.uid, Tier.PREMIUM)}
                    className="px-4 py-2 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-yellow-500 hover:bg-yellow-500/10 transition-all"
                  >
                    Premium
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#141414] border border-[#262626] rounded-[40px] p-8 flex flex-col h-[600px]">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                {selectedAdminUser ? `${selectedAdminUser.displayName}'s Chat` : 'Select a user to view chat'}
              </h3>
              {selectedAdminUser && (
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  {adminUserChats.length} Messages
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {!selectedAdminUser ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Select a user from the directory to monitor their AI interactions</p>
                </div>
              ) : adminUserChats.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <p className="text-gray-500 text-sm font-medium">No chat history found for this user</p>
                </div>
              ) : (
                adminUserChats.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex flex-col",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "max-w-[90%] px-4 py-3 rounded-2xl text-xs leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "bg-[#0D0D0D] text-gray-300 border border-[#262626]"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[8px] text-gray-600 mt-1 uppercase font-bold tracking-widest">
                      {msg.createdAt?.toDate().toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const quickActions = [
    { label: 'Apartment in New Cairo', icon: Building2 },
    { label: 'Villa in Sheikh Zayed', icon: Home },
    { label: 'Office in Maadi', icon: Briefcase },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-primary/20 flex flex-col">
      {/* Minimal Header with Logo */}
      <header className="p-8 flex items-center justify-between">
        <div className="flex items-center">
          {/* Logo removed as requested */}
        </div>
        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-6">
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/10",
                    showSettings && "bg-white/10 border-primary/50"
                  )}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  Settings
                  <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", showSettings && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {showSettings && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSettings(false)}
                        className="fixed inset-0 z-40"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-56 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          <button 
                            onClick={() => { setView('chat'); setShowSettings(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                              view === 'chat' ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <Sparkles className="w-4 h-4" />
                            AI Chat
                          </button>

                          {(profile?.tier === Tier.PLUS || profile?.tier === Tier.PREMIUM || profile?.role === Role.ADMIN) && (
                            <button 
                              onClick={() => { setView('dashboard'); setShowSettings(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                view === 'dashboard' ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <LayoutDashboard className="w-4 h-4" />
                              Dashboard
                            </button>
                          )}

                          {profile?.role === Role.ADMIN && (
                            <button 
                              onClick={() => { setView('admin'); setShowSettings(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                view === 'admin' ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <Users className="w-4 h-4" />
                              Admin Panel
                            </button>
                          )}

                          {/* Upgrade Plan removed as requested */}

                          <div className="h-px bg-[#262626] my-1" />

                          <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{user.displayName}</span>
                  <div className="flex items-center gap-2">
                    {profile?.tier !== Tier.FREE && (
                      <div className="flex items-center gap-1">
                        <Crown className={cn("w-2.5 h-2.5", profile?.tier === Tier.PREMIUM ? "text-yellow-500" : "text-primary")} />
                        <span className={cn("text-[8px] font-black uppercase tracking-widest", profile?.tier === Tier.PREMIUM ? "text-yellow-500" : "text-primary")}>
                          {profile?.tier}
                        </span>
                      </div>
                    )}
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                      {profile?.role === Role.ADMIN ? 'Administrator' : 'Client'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSignIn}
              className="bg-white/5 border border-white/10 hover:bg-white/10 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              {renderDashboardView()}
            </motion.div>
          ) : view === 'admin' ? (
            <motion.div key="admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              {renderAdminView()}
            </motion.div>
          ) : history.length === 0 ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex flex-col items-center space-y-12 mb-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-medium tracking-tight text-gray-200">How can I help today?</h2>
                <p className="text-lg text-gray-500 font-medium">Type a command or ask a question about Egyptian real estate</p>
              </div>

              <div className="w-full max-w-2xl bg-[#141414] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] hover:border-purple-500/40 transition-all duration-500 group">
                <div className="p-6 min-h-[120px]">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Ask about apartments, villas, or market trends..."
                    className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-gray-600 resize-none h-full"
                  />
                </div>
                <div className="p-4 bg-[#0D0D0D] border-t border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-[#1A1A1A] rounded-lg text-gray-500 transition-colors">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-[#1A1A1A] rounded-lg text-gray-500 transition-colors">
                      <Command className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSubmit()}
                    disabled={loading || !input.trim()}
                    className="bg-[#1A1A1A] border border-[#262626] hover:bg-[#262626] text-gray-300 px-6 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all disabled:opacity-20"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => setInput("Apartments in New Cairo")} className="bg-[#141414] border border-[#262626] hover:bg-[#1A1A1A] px-4 py-2 rounded-xl text-xs font-medium text-gray-400 flex items-center gap-2 transition-all">
                  <Building2 className="w-3.5 h-3.5" />
                  New Cairo
                </button>
                <button onClick={() => setInput("Villas in Sheikh Zayed")} className="bg-[#141414] border border-[#262626] hover:bg-[#1A1A1A] px-4 py-2 rounded-xl text-xs font-medium text-gray-400 flex items-center gap-2 transition-all">
                  <Home className="w-3.5 h-3.5" />
                  Sheikh Zayed
                </button>
                <button onClick={() => setInput("Offices in Maadi")} className="bg-[#141414] border border-[#262626] hover:bg-[#1A1A1A] px-4 py-2 rounded-xl text-xs font-medium text-gray-400 flex items-center gap-2 transition-all">
                  <Briefcase className="w-3.5 h-3.5" />
                  Maadi
                </button>
                <button onClick={() => setInput("Market Trends 2026")} className="bg-[#141414] border border-[#262626] hover:bg-[#1A1A1A] px-4 py-2 rounded-xl text-xs font-medium text-gray-400 flex items-center gap-2 transition-all">
                  <Sparkles className="w-3.5 h-3.5" />
                  Market Trends
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-[calc(100vh-200px)] flex flex-col"
            >
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-8 pb-12 custom-scrollbar pr-4"
              >
                {history.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex flex-col w-full",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "max-w-[80%] px-6 py-4 rounded-3xl text-base leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-[#1A1A1A] text-gray-100 border border-[#262626]" 
                        : "bg-transparent text-gray-300"
                    )}>
                      {msg.content.split('\n').map((line, j) => (
                        <p key={j} className={line ? "mt-1" : "h-2"}>{line}</p>
                      ))}
                      
                      {i === history.length - 1 && response?.isQuotaError && (
                        <div className="mt-4 p-5 bg-red-500/5 border border-red-500/10 rounded-[32px] backdrop-blur-md">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 bg-red-500/10 rounded-xl">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white tracking-tight">Usage Limit Reached</p>
                              <p className="text-xs text-gray-500 leading-relaxed mt-1">
                                {hasOwnKey 
                                  ? "Your personal API key has also reached its quota. Please check your billing settings on Google Cloud or wait for the quota to reset."
                                  : "The shared Gemini API quota has been exceeded. You can continue immediately by selecting your own API key."}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={handleOpenKeyDialog}
                              className="w-full bg-primary text-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                              Select Personal API Key
                            </button>
                            <button
                              onClick={() => {
                                const lastUserMsg = history.filter(h => h.role === 'user').pop();
                                if (lastUserMsg) {
                                  setInput(lastUserMsg.content);
                                  setHistory(prev => prev.slice(0, -2)); // Remove the failed exchange
                                }
                              }}
                              className="w-full bg-white/5 border border-white/10 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                              Retry Last Message
                            </button>
                          </div>
                          
                          <a 
                            href="https://ai.google.dev/gemini-api/docs/billing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block mt-4 text-[9px] text-gray-600 hover:text-gray-400 text-center underline transition-colors"
                          >
                            Learn about Gemini API billing & quotas
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {response?.recommendations && response.recommendations.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {response.recommendations.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-[#141414] border border-[#262626] rounded-[32px] overflow-hidden group hover:border-primary/50 transition-all"
                      >
                        <div className="relative h-48 overflow-hidden">
                          <img 
                            src={`https://picsum.photos/seed/${item.title}/800/600`} 
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-primary border border-white/10">
                            {item.price}
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <h3 className="font-bold text-lg tracking-tight">{item.title}</h3>
                          <div className="flex items-center gap-2 text-gray-500 text-xs">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </div>
                          <div className="flex items-center gap-4 py-3 border-y border-[#262626]">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400">
                              <Bed className="w-3.5 h-3.5" /> {item.rooms}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400">
                              <Bath className="w-3.5 h-3.5" /> {item.bathrooms}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400">
                              <Maximize className="w-3.5 h-3.5" /> {item.size}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 italic leading-relaxed">"{item.reason}"</p>
                          <button 
                            onClick={() => setSelectedProperty(item)}
                            className="w-full py-3 bg-[#1A1A1A] border border-[#262626] hover:bg-[#262626] text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
                          >
                            View Details
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {loading && (
                  <div className="flex items-center gap-3 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium italic">Searching...</span>
                  </div>
                )}
              </div>

              {/* Chat Input at Bottom when history exists */}
              <div className="mt-auto pb-6">
                <div className="w-full bg-[#141414] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] hover:border-purple-500/40 transition-all duration-500 group">
                  <div className="flex items-center px-4 py-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="Ask a follow-up..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-gray-600 resize-none py-3 h-12"
                    />
                    <div className="flex items-center gap-2 ml-4">
                      <button className="p-2 hover:bg-[#1A1A1A] rounded-lg text-gray-500 transition-colors">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading || !input.trim()}
                        className="bg-[#1A1A1A] border border-[#262626] hover:bg-[#262626] text-gray-300 p-2.5 rounded-xl transition-all disabled:opacity-20"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-[40px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Vodafone Cash</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Payment Gateway</p>
                  </div>
                  <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
                    <Smartphone className="text-white w-6 h-6" />
                  </div>
                </div>

                <div className="bg-[#0D0D0D] border border-[#262626] rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Amount to Pay</span>
                    <span className="text-xl font-black text-white">{showPaymentModal.price.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Target Tier</span>
                    <span className="text-xs font-black text-primary uppercase tracking-widest">{showPaymentModal.tier}</span>
                  </div>
                  <div className="h-px bg-[#262626]" />
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Transfer to this number:</p>
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                      <span className="text-lg font-black text-white tracking-widest">01020117504</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText('01020117504')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all text-primary"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreatePaymentRequest} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Your Wallet Number</label>
                    <input 
                      required
                      type="tel"
                      pattern="^010\d{8}$"
                      value={walletNumber}
                      onChange={e => setWalletNumber(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#262626] rounded-2xl px-6 py-4 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="010xxxxxxxx"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isProcessingPayment}
                    className="w-full py-5 bg-primary text-black font-black rounded-3xl text-sm uppercase tracking-[0.2em] hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirm Transfer
                  </button>
                  <p className="text-[9px] text-center text-gray-600 font-medium leading-relaxed">
                    By clicking confirm, you certify that you have transferred the amount. Admin will verify the transaction within 24 hours.
                  </p>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Property Details Modal */}
      <AnimatePresence>
        {selectedProperty && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProperty(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0D0D0D] border border-[#262626] rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <div className="w-full md:w-1/2 h-64 md:h-auto relative">
                <img 
                  src={`https://picsum.photos/seed/${selectedProperty.title}/800/800`} 
                  alt={selectedProperty.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setSelectedProperty(null)}
                  className="absolute top-4 left-4 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-black/60 transition-all"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <div className="w-full md:w-1/2 p-8 space-y-6 flex flex-col">
                <div className="space-y-2">
                  <div className="text-primary font-black text-2xl tracking-tight">{selectedProperty.price}</div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{selectedProperty.title}</h2>
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <MapPin className="w-4 h-4" />
                    {selectedProperty.location}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 py-6 border-y border-[#262626]">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Rooms</div>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Bed className="w-4 h-4 text-primary" /> {selectedProperty.rooms}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Baths</div>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Bath className="w-4 h-4 text-primary" /> {selectedProperty.bathrooms}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Size</div>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Maximize className="w-4 h-4 text-primary" /> {selectedProperty.size}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Features</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.features.map((f, i) => (
                      <span key={i} className="px-3 py-1 bg-[#1A1A1A] border border-[#262626] rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <button className="w-full py-4 bg-primary text-black font-black rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20">
                    Contact Agent
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}
