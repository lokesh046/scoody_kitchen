import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { checkoutCart } from '../../api/orders';
import type { OrderResponse } from '../../api/orders';
import { createPayment, simulatePaymentSuccess, simulatePaymentFailure, verifyRazorpayPayment } from '../../api/payments';
import type { PaymentResponse } from '../../api/payments';
import { auth } from '../../api/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { verifyFirebasePhoneToken, requestOtpPreCheck } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, 
  MapPin, ShieldCheck, Truck, Loader2, AlertCircle, ShoppingCart, Compass
} from 'lucide-react';

const triggerCheckoutConfetti = () => {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const colors = ['#D09E6B', '#362820', '#8FA89B', '#F9F6F0', '#3F5E4D'];
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    shape: 'circle' | 'square';
  }
  const particles: Particle[] = [];

  const createBlast = (originX: number, angleRange: [number, number]) => {
    for (let i = 0; i < 65; i++) {
      const angle = angleRange[0] + Math.random() * (angleRange[1] - angleRange[0]);
      const speed = 10 + Math.random() * 20;
      particles.push({
        x: originX,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.1 + Math.random() * 0.2,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      });
    }
  };

  const createTopShower = () => {
    for (let i = 0; i < 110; i++) {
      const angle = Math.PI / 3 + Math.random() * (Math.PI / 3);
      const speed = 3 + Math.random() * 12;
      particles.push({
        x: Math.random() * window.innerWidth,
        y: -15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.05 + Math.random() * 0.1,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      });
    }
  };

  createBlast(0, [Math.PI / 8, Math.PI * 3 / 8]);
  createBlast(window.innerWidth, [Math.PI * 5 / 8, Math.PI * 7 / 8]);
  createTopShower();

  let active = true;
  const startTime = Date.now();

  const update = () => {
    if (!active) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const elapsed = Date.now() - startTime;
    if (elapsed > 2500) {
      active = false;
      window.removeEventListener('resize', resizeCanvas);
      try {
        document.body.removeChild(canvas);
      } catch (e) {}
      return;
    }

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.20;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.rotation += p.rotationSpeed;
      
      if (elapsed > 1500) {
        p.opacity = Math.max(0, 1 - (elapsed - 1500) / 1000);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
};

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken, setAuth } = useAuthStore();
  const { items: cartItems, totalAmount, clear: clearCart } = useCartStore();
  
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');
  const formatPhoneForState = (rawPhone?: string | null) => {
    if (!rawPhone) return '';
    const clean = rawPhone.trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('+91')) {
      return clean.slice(3);
    }
    return clean;
  };

  const [phone, setPhone] = useState(formatPhoneForState(user?.phone));
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [detectedCountryCode, setDetectedCountryCode] = useState('in');
  
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Placed Order & Payment Simulation state
  const [placedOrder, setPlacedOrder] = useState<OrderResponse | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('IDLE');

  // Phone Verification States
  const [isVerifyWarningOpen, setIsVerifyWarningOpen] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verificationStep, setVerificationStep] = useState<1 | 2>(1);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [isVerifyingLoading, setIsVerifyingLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);

  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Manage SMS resend cooldown timer countdown
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldownCountdown > 0 && isVerifyingPhone) {
      timer = setInterval(() => {
        setCooldownCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownCountdown, isVerifyingPhone]);



  // Trigger confetti explosion on successful checkout
  useEffect(() => {
    if (paymentStatus === 'SUCCESS') {
      triggerCheckoutConfetti();
    }
  }, [paymentStatus]);

  useEffect(() => {
    if (user) {
      setPhone(formatPhoneForState(user.phone));
    }
  }, [user]);

  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Dynamic Razorpay Checkout SDK Script Injection
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.id = 'razorpay-checkout-js';
    document.body.appendChild(script);

    return () => {
      const existingScript = document.getElementById('razorpay-checkout-js');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Dynamic Leaflet CSS Injection
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.id = 'leaflet-css';
    document.head.appendChild(link);

    return () => {
      const existingLink = document.getElementById('leaflet-css');
      if (existingLink) {
        existingLink.remove();
      }
    };
  }, []);

  // Map Initialization via Callback Ref (Safe from hydration conditional rendering bugs)
  const mapContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      if (!mapRef.current) {
        // Fix default marker icon issue in Leaflet + Vite
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const initialLat = 13.0827;
        const initialLng = 80.2707;

        const map = L.map(node, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([initialLat, initialLng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
        }).addTo(map);

        // Listener on Pin drag
        marker.on('dragend', async (e) => {
          const { lat, lng } = e.target.getLatLng();
          // Do not updateMap center on drag, just reverse-geocode to avoid jitter
          await reverseGeocode(lat, lng, false);
        });

        // Listener on Map click to move pin
        map.on('click', async (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          await reverseGeocode(lat, lng, false);
        });

        mapRef.current = map;
        markerRef.current = marker;
        
        // Trigger tile size recalculation 250ms after element settles in layout
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 250);
      }
    } else {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    }
  }, []);

  const updateMapMarker = (lat: number, lng: number) => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], 15);
      
      // Force leaflet window resize trigger to fix grey tiles container bug
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 250);
    }
  };

  const reverseGeocode = async (lat: number, lon: number, updateMap = true) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        setDoorNo(addr.house_number || addr.building || '');
        
        // Build a complete street description incorporating road, district, and postcode
        const streetParts = [
          addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || '',
          addr.city_district || '',
          addr.postcode || ''
        ].filter(Boolean);
        
        setStreet(streetParts.join(', '));
        setCity(addr.city || addr.town || addr.village || addr.county || '');
        setState(addr.state || addr.region || '');
        setCountry(addr.country || '');
        
        if (addr.postcode) {
          setPincode(addr.postcode);
        }

        if (addr.country_code) {
          setDetectedCountryCode(addr.country_code.toLowerCase());
        }

        if (updateMap) {
          updateMapMarker(lat, lon);
        }
        
        // Display approximate location status warning
        setErrorMessage('⚠️ Location auto-detection is approximate. Please verify and edit all address fields below.');
      } else {
        setErrorMessage('Could not resolve coordinates to a physical address. Please enter details manually.');
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
      setErrorMessage('Failed to resolve address from coordinates.');
    }
  };

  const handleDetectLocation = () => {
    setIsLocating(true);
    setErrorMessage('');

    const fallbackToIpGeocode = async () => {
      try {
        const ipRes = await fetch('https://freeipapi.com/api/json');
        if (!ipRes.ok) throw new Error('IP lookup returned error');
        const ipData = await ipRes.json();
        
        if (ipData.latitude !== undefined && ipData.longitude !== undefined) {
          await reverseGeocode(ipData.latitude, ipData.longitude, true);
        } else {
          throw new Error('IP coordinates not found');
        }
      } catch (err: any) {
        console.error('IP geocoding fallback failed:', err);
        setErrorMessage('Failed to detect location automatically. Please enter your address manually.');
      } finally {
        setIsLocating(false);
      }
    };

    if (!navigator.geolocation) {
      fallbackToIpGeocode();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          await reverseGeocode(latitude, longitude, true);
        } catch (err) {
          console.error('Error reverse geocoding browser coordinates:', err);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.warn('Browser Geolocation failed, attempting IP fallback...', err);
        fallbackToIpGeocode();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getCountryCode = (countryName: string): string => {
    const name = countryName.trim().toLowerCase();
    if (!name) return '';
    if (name.includes('india')) return 'in';
    if (name.includes('united states') || name.includes('usa') || name.includes('us')) return 'us';
    if (name.includes('united kingdom') || name.includes('uk') || name.includes('gb') || name.includes('england')) return 'gb';
    if (name.includes('canada')) return 'ca';
    if (name.includes('australia')) return 'au';
    if (name.includes('germany')) return 'de';
    if (name.includes('france')) return 'fr';
    return '';
  };

  const handleZipLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode.trim()) {
      setErrorMessage('Please enter a Pincode / Zip Code.');
      return;
    }

    setIsLookupLoading(true);
    setErrorMessage('');

    try {
      let url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}&format=json&limit=1`;
      
      const activeCountryCode = getCountryCode(country) || detectedCountryCode || 'in';
      if (activeCountryCode) {
        url += `&countrycodes=${activeCountryCode}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        await reverseGeocode(lat, lon, true);
      } else {
        setErrorMessage(`Pincode / Zip Code not found in selected country (${activeCountryCode.toUpperCase()}). Please enter details manually.`);
      }
    } catch (err) {
      console.error('Pincode lookup failed:', err);
      setErrorMessage('Failed to search pincode details.');
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleIpLocate = async () => {
    setIsLocating(true);
    setErrorMessage('');
    try {
      const ipRes = await fetch('https://freeipapi.com/api/json');
      if (!ipRes.ok) throw new Error('IP lookup returned error');
      const ipData = await ipRes.json();
      
      if (ipData.latitude !== undefined && ipData.longitude !== undefined) {
        await reverseGeocode(ipData.latitude, ipData.longitude, true);
        setErrorMessage('🌐 Located approximately via IP Geolocation.');
      } else {
        throw new Error('IP coordinates not found');
      }
    } catch (err: any) {
      console.error('IP geocoding failed:', err);
      setErrorMessage('Failed to detect location via IP. Please enter your address manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleStartPhoneVerification = () => {
    if (!phone || phone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }

    setErrorMessage('');
    setVerifyError(null);
    setVerificationCode('');
    setVerificationStep(1);
    setIsVerifyingPhone(true);
  };

  const handleSendOtp = async () => {
    setIsVerifyingLoading(true);
    setVerifyError(null);
    const fullPhone = `+91${phone}`;
    try {
      const rateLimitResponse = await requestOtpPreCheck(fullPhone);
      if (rateLimitResponse.attempts_remaining !== undefined) {
        setAttemptsRemaining(rateLimitResponse.attempts_remaining);
      }

      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '<div id="recaptcha-verifier-anchor"></div>';
      }

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-verifier-anchor', {
        size: 'invisible',
        callback: () => {}
      });
      setRecaptchaVerifier(verifier);

      const confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmResult(confirmation);
      setVerificationStep(2);
      setCooldownCountdown(30);
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      setVerifyError(
        err.response?.data?.detail || 
        err.message || 
        'Failed to send SMS code. Please check credentials and format.'
      );
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {}
      }
    } finally {
      setIsVerifyingLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationCode) {
      setVerifyError('Please enter the 6-digit OTP code.');
      return;
    }
    setIsVerifyingLoading(true);
    setVerifyError(null);
    try {
      let idToken = '';
      if (verificationCode === '111111') {
        idToken = 'test_firebase_token';
      } else {
        if (!confirmResult) {
          throw new Error('Verification session has expired. Please send OTP again.');
        }
        const userCredential = await confirmResult.confirm(verificationCode);
        idToken = await userCredential.user.getIdToken();
      }

      const updatedUser = await verifyFirebasePhoneToken(idToken);
      setAuth(updatedUser, accessToken);
      setIsVerifyingPhone(false);
      setErrorMessage('');
      
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('OTP Verification failed:', err);
      setVerifyError(err.response?.data?.detail || err.message || 'Incorrect OTP code. Please try again.');
    } finally {
      setIsVerifyingLoading(false);
    }
  };

  const handleCloseVerification = () => {
    setIsVerifyingPhone(false);
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {}
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handlePlaceOrder triggered!");
    console.log("Current User:", user);
    console.log("Phone number state:", phone);
    console.log("Is phone verified:", user?.is_phone_verified);

    if (!user?.is_phone_verified) {
      console.log("Encountered unverified user - opening warning popup modal!");
      setIsVerifyWarningOpen(true);
      return;
    }

    if (!doorNo || !street || !city || !state || !country || !phone) {
      console.log("Address verification failed - missing fields");
      setErrorMessage('Please fill in all address and contact details.');
      return;
    }

    if (phone.trim().length !== 10) {
      console.log("Phone length validation failed");
      setErrorMessage('Please enter a valid 10-digit contact phone number.');
      return;
    }

    const combinedAddress = `Door No: ${doorNo}, ${street}, ${city}, ${state}, ${country}`;

    if (combinedAddress.trim().length < 10) {
      console.log("Address length validation failed");
      setErrorMessage('Please enter a valid shipping address (minimum 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    console.log("Proceeding to checkoutCart API call...");

    try {
      const order = await checkoutCart(combinedAddress, 'CARD', `+91${phone}`);
      setPlacedOrder(order);
      if (order.razorpay_order_id) {
        setPaymentSession({
          id: 0,
          order_id: order.id,
          payment_method: 'CARD',
          amount: order.total_amount,
          status: 'PENDING',
          transaction_id: null,
          razorpay_order_id: order.razorpay_order_id,
          razorpay_key_id: order.razorpay_key_id,
          created_at: order.created_at,
          updated_at: order.updated_at
        });
      } else {
        setPaymentSession(null);
      }
    } catch (err: any) {
      console.error('Checkout failed:', err);
      setErrorMessage(
        err.response?.data?.detail || 
        'Failed to process checkout. Please check your network and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckoutSuccess = () => {
    clearCart();
    setDoorNo('');
    setStreet('');
    setCity('');
    setState('');
    setCountry('');
    setPincode('');
  };

  const handlePayment = async (simulateSuccess: boolean) => {
    if (!placedOrder) return;
    
    if (paymentMethod === 'CARD') {
      if (!simulateSuccess) {
        setPaymentStatus('PROCESSING');
        setErrorMessage('');
        try {
          if (!paymentSession) {
            await createPayment(placedOrder.id, paymentMethod);
          }
          await simulatePaymentFailure(placedOrder.id);
          setPaymentStatus('FAILED');
          setErrorMessage('Payment simulation declined. Please try again with a valid card.');
        } catch (err: any) {
          setPaymentStatus('FAILED');
          setErrorMessage(err.response?.data?.detail || 'Failed to simulate payment decline.');
        }
        return;
      }

      setPaymentStatus('PROCESSING');
      setErrorMessage('');

      try {
        const session = paymentSession || await createPayment(placedOrder.id, paymentMethod);
        
        if (session.razorpay_order_id && session.razorpay_key_id) {
          const options = {
            key: session.razorpay_key_id,
            amount: Math.round(parseFloat(session.amount) * 100),
            currency: 'INR',
            name: "Scooby's Kitchen",
            description: `Order Subscription #${placedOrder.id}`,
            order_id: session.razorpay_order_id,
            handler: async (response: any) => {
              setPaymentStatus('PROCESSING');
              try {
                const verifyRes = await verifyRazorpayPayment({
                  order_id: placedOrder.id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                });
                if (verifyRes.status === 'COMPLETED' || (verifyRes.status as string) === 'success') {
                  setPaymentStatus('SUCCESS');
                  handleCheckoutSuccess();
                } else {
                  setPaymentStatus('FAILED');
                  setErrorMessage('Razorpay verification signature failed. Order cancelled.');
                }
              } catch (err: any) {
                setPaymentStatus('FAILED');
                setErrorMessage(err.response?.data?.detail || 'Razorpay signature verification rejected.');
              }
            },
            prefill: {
              name: user?.first_name || 'Pet Parent',
              email: user?.email || '',
            },
            theme: {
              color: '#D97706',
            },
            modal: {
              ondismiss: () => {
                setPaymentStatus('FAILED');
                setErrorMessage('Payment window dismissed by user.');
              }
            }
          };
          
          if ((window as any).Razorpay) {
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
          } else {
            setPaymentStatus('FAILED');
            setErrorMessage('Razorpay checkout SDK failed to load. Please check your internet connection.');
          }
        } else {
          if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
            setPaymentStatus('IDLE');
            setErrorMessage('Please enter all mock card details (or configure Razorpay API keys in backend).');
            return;
          }
          await simulatePaymentSuccess(placedOrder.id);
          setPaymentStatus('SUCCESS');
          handleCheckoutSuccess();
        }
      } catch (err: any) {
        console.error('Payment processing failed:', err);
        setPaymentStatus('FAILED');
        setErrorMessage(
          err.response?.data?.detail || 
          'Failed to process payment session. Please try again.'
        );
      }
    } else {
      setPaymentStatus('PROCESSING');
      setErrorMessage('');
      try {
        await createPayment(placedOrder.id, paymentMethod);
        await simulatePaymentSuccess(placedOrder.id);
        setPaymentStatus('SUCCESS');
        handleCheckoutSuccess();
      } catch (err: any) {
        setPaymentStatus('FAILED');
        setErrorMessage(err.response?.data?.detail || 'COD payment initialization failed.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="shop" onCartToggle={() => setIsCartOpen(true)} />

      {/* Centered Main Content Wrapper */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

      {/* Back Link */}
      <div className="mb-8 text-left">
        <button
          onClick={() => navigate('/shop')}
          className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Product Ledger</span>
        </button>
      </div>

      {placedOrder ? (
        /* Payment Simulation Screen */
        <div className="max-w-2xl mx-auto border-double border-4 border-cardboard bg-paperLight p-8 rounded-none shadow-md my-12 text-left space-y-6 relative animate-fade-in-up">
          <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-none border-x border-b border-cardboard font-bold">
            SECURE CHECKOUT TERMINAL
          </div>

          <div className="space-y-1">
            <Eyebrow label="STEP 2 OF 2 — PAYMENT PROCESSOR" />
            <h2 className="font-display font-black text-3xl uppercase tracking-tight text-ink">
              Secure Sourced Payment
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Confirm your checkout selection for Order ID <span className="font-mono font-bold text-herb">#{placedOrder.id}</span>.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {paymentStatus === 'SUCCESS' ? (
            /* Success confirmation display */
            <div className="text-center py-8 space-y-6 animate-fade-in-up">
              <div className="w-20 h-20 bg-paper border-4 border-double border-cardboard text-herb flex items-center justify-center mx-auto animate-pulse">
                <ShieldCheck className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-2xl uppercase tracking-tight text-ink">Payment Successful!</h3>
                <p className="font-body text-xs text-ink opacity-80 max-w-sm mx-auto leading-relaxed">
                  Your payment of <span className="font-mono font-bold text-turmeric">${parseFloat(placedOrder.total_amount).toFixed(2)}</span> has been confirmed. Recipes are being prepared fresh in the kitchen!
                </p>
              </div>
              <button
                onClick={() => navigate('/orders')}
                className="bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-8 py-4 rounded-none tracking-wider hover-bounce cursor-pointer shadow-sm"
              >
                Go to Order History 🐾
              </button>
            </div>
          ) : (
            /* Form inputs */
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-paper p-4 rounded-none border border-cardboard border-dashed">
                <div>
                  <span className="font-mono text-[9px] uppercase text-cardboard font-bold block">Grand Total Due</span>
                  <span className="font-mono font-bold text-turmeric text-lg">${parseFloat(placedOrder.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`font-mono text-[9px] uppercase font-bold py-2 px-4 rounded-none border ${
                      paymentMethod === 'CARD' ? 'bg-herb text-paper border-herb' : 'border-cardboard text-ink hover:bg-paper'
                    } cursor-pointer transition-colors`}
                  >
                    Credit Card 💳
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`font-mono text-[9px] uppercase font-bold py-2 px-4 rounded-none border ${
                      paymentMethod === 'CASH' ? 'bg-herb text-paper border-herb' : 'border-cardboard text-ink hover:bg-paper'
                    } cursor-pointer transition-colors`}
                  >
                    Cash / COD 💵
                  </button>
                </div>
              </div>

              {paymentMethod === 'CARD' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="cardholder" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Cardholder Name:
                    </label>
                    <input
                      type="text"
                      id="cardholder"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                      disabled={paymentStatus === 'PROCESSING'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="cardNumber" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Card Number:
                    </label>
                    <input
                      type="text"
                      id="cardNumber"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="e.g. 4111 1111 1111 1111"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                      disabled={paymentStatus === 'PROCESSING'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="expiry" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        Expiry Date:
                      </label>
                      <input
                        type="text"
                        id="expiry"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                        disabled={paymentStatus === 'PROCESSING'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="cvv" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        CVV Code:
                      </label>
                      <input
                        type="password"
                        id="cvv"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                        disabled={paymentStatus === 'PROCESSING'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="border border-turmeric border-opacity-35 bg-red-50 p-3 rounded-none flex items-start space-x-2 text-paprika font-body text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className={`grid grid-cols-1 ${paymentMethod === 'CARD' && paymentSession?.razorpay_order_id ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} gap-4 pt-2`}>
                <button
                  onClick={() => handlePayment(true)}
                  disabled={paymentStatus === 'PROCESSING'}
                  className="bg-herb hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 rounded-none tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer hover-bounce"
                >
                  {paymentStatus === 'PROCESSING' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : paymentMethod === 'CASH' ? (
                    <span>💳 Confirm COD Order</span>
                  ) : paymentSession?.razorpay_order_id ? (
                    <span>💳 Pay with Razorpay</span>
                  ) : (
                    <span>💳 Complete Payment (Simulate Success)</span>
                  )}
                </button>
                {paymentMethod === 'CARD' && !paymentSession?.razorpay_order_id && (
                  <button
                    onClick={() => handlePayment(false)}
                    disabled={paymentStatus === 'PROCESSING'}
                    className="border border-cardboard text-ink hover:bg-red-50 font-body font-bold text-xs uppercase py-3.5 rounded-none tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer hover-bounce"
                  >
                    <span>⚠️ Simulate Failure</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : cartItems.length === 0 ? (
        /* Empty State */
        <div className="max-w-md mx-auto border border-cardboard bg-paperLight p-8 rounded-sm text-center shadow-md my-12">
          <ShoppingCart className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
          <h4 className="font-display font-bold text-lg text-ink mb-2">Your Ledger is Empty</h4>
          <p className="font-body text-xs text-ink opacity-80 mb-6">
            You cannot proceed to checkout without adding human-grade recipes to your cart first.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
          >
            Sourced Products Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start text-left">
          {/* Left Column - Shipping Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="border-double border-4 border-cardboard bg-paperLight p-8 rounded-none shadow-md space-y-6 relative animate-fade-in-up">
              <div className="space-y-1">
                <Eyebrow label="STEP 1 OF 2 — DELIVERY DETAILS" />
                <h2 className="font-display font-black text-3xl uppercase tracking-tight text-ink">
                  Sourcing Shipping Address
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-dashed border-cardboard border-opacity-40">
                <p className="font-body text-xs text-ink opacity-70 leading-relaxed max-w-md">
                  Every order is prepared fresh in our veterinary kitchen. Provide a clear address for safe delivery.
                </p>
                <div className="flex space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isLocating || isSubmitting}
                    className="font-mono text-[9px] uppercase tracking-wider text-herb border border-herb border-dashed hover:bg-paper rounded-none px-3 py-2 flex items-center space-x-1 hover:text-ink transition-colors disabled:opacity-50 hover-bounce cursor-pointer"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-herb" />
                        <span>Locating...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-3 h-3 text-herb" />
                        <span>GPS Locate 🐾</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleIpLocate}
                    disabled={isLocating || isSubmitting}
                    className="font-mono text-[9px] uppercase tracking-wider text-turmeric border border-turmeric border-dashed hover:bg-paper rounded-none px-3 py-2 flex items-center space-x-1 hover:text-ink transition-colors disabled:opacity-50 hover-bounce cursor-pointer"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-turmeric" />
                        <span>Locating...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3 h-3 text-turmeric" />
                        <span>IP Locate 🌐</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <form onSubmit={handlePlaceOrder} className="space-y-4">
                {/* Pincode / Zip Code Quick Search Lookup */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="pincode" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🔍 Quick Zip / Pincode Lookup:
                    </label>
                    <input
                      type="text"
                      id="pincode"
                      autoComplete="new-password"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 600016 or 90210"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting || isLookupLoading}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleZipLookup}
                      disabled={isSubmitting || isLookupLoading || !pincode.trim()}
                      className="w-full bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[9px] uppercase py-2.5 font-bold rounded-none disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 hover-bounce cursor-pointer"
                    >
                      {isLookupLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Lookup 🔍</span>
                      )}
                    </button>
                  </div>
                </div>

                <hr className="border-t border-dashed border-cardboard border-opacity-40" />

                {/* Row 1: Door No & Street */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 space-y-1.5">
                    <label htmlFor="doorNo" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🏡 Door / Flat No:
                    </label>
                    <input
                      type="text"
                      id="doorNo"
                      autoComplete="new-password"
                      value={doorNo}
                      onChange={(e) => setDoorNo(e.target.value)}
                      placeholder="e.g. Flat 4B"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="street" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🛣️ Street Name:
                    </label>
                    <input
                      type="text"
                      id="street"
                      autoComplete="new-password"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="e.g. Baker Street"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: City & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="city" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🌆 City:
                    </label>
                    <input
                      type="text"
                      id="city"
                      autoComplete="new-password"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. London"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="state" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      📍 State / Region:
                    </label>
                    <input
                      type="text"
                      id="state"
                      autoComplete="new-password"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. England"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Row 3: Country & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="country" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🇬🇧 Country:
                    </label>
                    <input
                      type="text"
                      id="country"
                      autoComplete="new-password"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. United Kingdom"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-1.5" id="phone-container">
                    <div className="flex justify-between items-baseline">
                      <label htmlFor="phone" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        📞 Contact Phone Number:
                      </label>
                      {user?.is_phone_verified ? (
                        <span className="font-mono text-[8px] text-herb font-bold flex items-center space-x-1 uppercase tracking-wider">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verified via SMS</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[8px] text-paprika font-bold uppercase tracking-wider">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <div className="flex-grow flex items-center border border-cardboard rounded-none bg-paper focus-within:border-turmeric focus-within:ring-1 focus-within:ring-turmeric transition-colors">
                        <div className="pl-3 pr-2 flex items-center space-x-1 border-r border-cardboard border-opacity-35 select-none">
                          <span className="font-mono text-xs font-bold text-ink">+91</span>
                        </div>
                        <input
                          type="tel"
                          id="phone"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          className="w-full px-3 py-2 bg-transparent font-mono text-xs text-ink placeholder-cardboard focus:outline-none disabled:opacity-85"
                          disabled={isSubmitting || user?.is_phone_verified}
                          required
                        />
                      </div>
                      {!user?.is_phone_verified && (
                        <button
                          type="button"
                          onClick={handleStartPhoneVerification}
                          className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase font-bold px-4 py-2 border border-cardboard cursor-pointer shrink-0 transition-colors shadow-xs"
                        >
                          Verify SMS
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interactive Leaflet Map Container */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    📍 Verify Delivery Location (Drag pin or click map to refine):
                  </label>
                  <div 
                    id="checkout-map" 
                    ref={mapContainerRef}
                    className="h-56 w-full border-double border-4 border-cardboard rounded-none shadow-sm relative overflow-hidden bg-paper"
                    style={{ zIndex: 1 }}
                  ></div>
                </div>

                {errorMessage && (
                  <div className="border border-turmeric border-opacity-35 bg-red-50 p-3 rounded-none flex items-start space-x-2 text-paprika font-body text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Shipping info cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="border border-cardboard border-dashed p-3 rounded-none flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
                    <Truck className="w-5 h-5 text-herb shrink-0" />
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-herb block leading-tight">Fresh Transit</span>
                      <span className="font-body text-[10px] text-ink opacity-80 leading-none">Delivered in 2-3 Days</span>
                    </div>
                  </div>
                  <div className="border border-cardboard border-dashed p-3 rounded-none flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
                    <ShieldCheck className="w-5 h-5 text-turmeric shrink-0" />
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-turmeric block leading-tight">100% Guaranteed</span>
                      <span className="font-body text-[10px] text-ink opacity-80 leading-none">Fresh-seal Packaging</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Receipt Summary */}
          <div className="lg:col-span-5">
            <div className="border-double border-4 border-cardboard bg-paperLight p-8 rounded-none shadow-md space-y-6 relative overflow-hidden animate-fade-in-up">
              {/* Page Tab */}
              <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-none border-x border-b border-cardboard font-bold">
                NOTEBOOK RECEIPT
              </div>

              <div className="space-y-1">
                <Eyebrow label="STEP 2 OF 2 — ORDER SUMMARY" />
                <h3 className="font-display font-black text-3xl uppercase tracking-tight text-ink">
                  Recipe Receipt
                </h3>
              </div>

              <hr className="border-t border-dashed border-cardboard" />

              {/* Items Breakdown */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-start text-xs">
                    <div className="max-w-[70%] text-left">
                      <span className="font-display font-bold text-ink block">{item.name}</span>
                      <span className="font-mono text-[10px] text-herb">
                        Qty: {item.quantity} × ${parseFloat(item.price).toFixed(2)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-ink">
                      ${parseFloat(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <hr className="border-t border-dashed border-cardboard" />

              {/* Running Totals */}
              <div className="space-y-2 font-mono text-xs">
                {/* Subtotal */}
                <div className="flex justify-between items-center dotted-divider pb-1">
                  <span className="bg-paperLight pr-2 text-herb font-bold uppercase tracking-wider text-[10px]">SUBTOTAL</span>
                  <span className="bg-paperLight pl-2 text-ink font-bold">${totalAmount.toFixed(2)}</span>
                </div>
                
                {/* Shipping */}
                <div className="flex justify-between items-center dotted-divider pb-1">
                  <span className="bg-paperLight pr-2 text-cardboard font-bold uppercase tracking-wider text-[10px]">SHIPPING</span>
                  <span className="bg-paperLight pl-2 text-herb font-bold">FREE TASTING SHIP</span>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="font-display text-xs font-bold text-ink uppercase tracking-wider">TOTAL INK DUE</span>
                  <span className="font-mono font-bold text-turmeric text-lg">${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs uppercase py-4 rounded-none tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 hover-bounce cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : (
                  <span>Place Order & Cook Recipes 🐾</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Phone Verification Required Alert Warning Modal */}
      {isVerifyWarningOpen && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
          <div className="bg-paperLight border-double border-4 border-cardboard rounded-none shadow-2xl max-w-md w-full p-6 space-y-6 animate-fade-in text-left">
            <div className="flex justify-between items-start border-b border-cardboard border-opacity-30 pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                  ACTION REQUIRED
                </span>
                <h3 className="font-display font-black text-2xl text-ink uppercase tracking-tight">
                  Verify Phone Number
                </h3>
              </div>
              <button 
                onClick={() => setIsVerifyWarningOpen(false)}
                className="text-ink hover:text-paprika font-mono font-bold text-sm cursor-pointer border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                For secure packing and courier delivery updates, you must verify your contact phone number before placing this order.
              </p>
              
              <div className="p-3 bg-paper border border-cardboard border-dashed flex justify-between items-center">
                <span className="font-mono text-[10px] uppercase text-herb font-bold">Contact Number:</span>
                <span className="font-mono text-xs font-bold text-ink">+91 {phone || 'Not Provided'}</span>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyWarningOpen(false);
                    // Smoothly scroll to the phone container element
                    const element = document.getElementById('phone-container');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // Flash input border
                      const inputElement = document.getElementById('phone');
                      if (inputElement) {
                        inputElement.focus();
                        inputElement.classList.add('ring-2', 'ring-turmeric');
                        setTimeout(() => {
                          inputElement.classList.remove('ring-2', 'ring-turmeric');
                        }, 2500);
                      }
                    }
                    // Immediately trigger verification
                    handleStartPhoneVerification();
                  }}
                  className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3.5 rounded-none tracking-wide uppercase transition-colors flex items-center justify-center space-x-2 cursor-pointer border-0"
                >
                  <span>Verify Contact Number via SMS</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsVerifyWarningOpen(false)}
                  className="w-full bg-paper hover:bg-paperLight text-ink font-mono text-[10px] py-2 rounded-none border border-cardboard border-opacity-50 uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Dismiss & Edit Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container">
        <div id="recaptcha-verifier-anchor"></div>
      </div>

      {/* Retro Ledger Phone Verification Modal */}
      {isVerifyingPhone && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-paperLight border-double border-4 border-cardboard rounded-none shadow-2xl max-w-md w-full p-6 space-y-6 animate-fade-in text-left">
            <div className="flex justify-between items-start border-b border-cardboard border-opacity-30 pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                  REGISTRY PHONE VERIFICATION
                </span>
                <h3 className="font-display font-black text-2xl text-ink uppercase tracking-tight">
                  SMS Authentication
                </h3>
              </div>
              <button 
                onClick={handleCloseVerification}
                className="text-ink hover:text-paprika font-mono font-bold text-sm cursor-pointer border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            {verifyError && (
              <div className="bg-red-50 border border-turmeric text-paprika font-body text-xs p-2.5 rounded-none font-bold">
                ⚠️ {verifyError}
              </div>
            )}

            {verificationStep === 1 ? (
              <div className="space-y-4">
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  We will send a one-time verification code to your registered profile number: 
                  <strong className="text-ink ml-1 font-mono">+91 {phone}</strong>.
                </p>
                
                <p className="font-mono text-[10px] text-herb opacity-80">
                  * The country prefix (+91) is statically applied to your contact number.
                </p>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isVerifyingLoading}
                    className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3.5 rounded-none tracking-wide uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer border-0"
                  >
                    {isVerifyingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending SMS OTP...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationStep(2);
                      setVerifyError("Local test mode enabled. Input '111111' to mock verification success.");
                    }}
                    className="w-full bg-paper hover:bg-paperLight text-ink font-mono text-[10px] py-2 rounded-none border border-cardboard border-opacity-50 uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    ⚡ Local Sandbox Bypass (Bypass SMS)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-mono text-center text-lg tracking-widest text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>

                <p className="font-body text-xs text-ink opacity-70 leading-relaxed">
                  Enter the verification code sent to your phone. Code is valid for 5 minutes.
                </p>

                {attemptsRemaining !== null && (
                  <p className="font-mono text-[10px] text-paprika font-bold uppercase">
                    Hourly Attempts Remaining: {attemptsRemaining} of 3
                  </p>
                )}

                <div className="pt-2 flex space-x-3">
                  {cooldownCountdown > 0 ? (
                    <button
                      type="button"
                      disabled={true}
                      className="w-1/3 border border-cardboard border-opacity-40 font-mono text-[10px] uppercase py-3 rounded-none text-cardboard cursor-not-allowed text-center bg-transparent"
                    >
                      Resend ({cooldownCountdown}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isVerifyingLoading}
                      className="w-1/3 border border-cardboard bg-transparent hover:bg-paper font-mono text-[11px] uppercase py-3 rounded-none tracking-wide text-ink cursor-pointer transition-colors"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingLoading}
                    className="w-2/3 bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3 rounded-none tracking-wide uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer border-0"
                  >
                    {isVerifyingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verify OTP...</span>
                      </>
                    ) : (
                      <span>Verify Code</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      </main>
      {/* Footer */}
      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[9px] uppercase tracking-wider">
          © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
