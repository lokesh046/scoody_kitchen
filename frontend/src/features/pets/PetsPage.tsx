import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyPets, createPet, deletePet } from '../../api/pets';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, 
  Trash2, Plus, Scale, Loader2, AlertCircle,
  Dna, Heart, Award, Cake, Tag
} from 'lucide-react';

export const PetsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const { items: cartItems, clear: clearCart } = useCartStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Form State
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const { data: pets, isLoading, error } = useQuery({
    queryKey: ['pets'],
    queryFn: fetchMyPets,
  });

  // Create Pet Mutation
  const createMutation = useMutation({
    mutationFn: (petData: any) => createPet(petData),
    onSuccess: () => {
      // Invalidate pets cache to reload history
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      // Reset Form fields
      setName('');
      setBreed('');
      setDob('');
      setWeight('');
      setFormError('');
    },
    onError: (err: any) => {
      console.error('Failed to create pet:', err);
      setFormError(err.response?.data?.detail || 'Failed to register pet profile.');
    }
  });

  // Delete Pet Mutation
  const deleteMutation = useMutation({
    mutationFn: (petId: number) => deletePet(petId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pets'] });
    },
    onError: (err) => {
      console.error('Failed to delete pet:', err);
    }
  });

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      clearCart();
      navigate('/login');
    }
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a valid pet name.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const petPayload = {
      name,
      species,
      breed: breed.trim() || null,
      gender: gender || null,
      date_of_birth: dob || null,
      weight: weight ? parseFloat(weight) : null,
    };

    createMutation.mutate(petPayload, {
      onSettled: () => {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <header className="w-full border-b border-cardboard border-opacity-25 bg-ink bg-opacity-95 backdrop-blur-md sticky top-0 z-30 shadow-sm text-paper">
        <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center md:grid md:grid-cols-12">
          
          {/* Left Corner: Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer md:col-span-3 justify-start select-none" onClick={() => navigate('/')}>
            <PawPrint className="text-turmeric w-6 h-6 animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-2xl tracking-tight text-paper">
                Scooby's Kitchen
              </h1>
              <p className="font-mono text-[9px] uppercase tracking-wider text-turmeric opacity-85">
                Notebook Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper md:col-span-6 justify-center">
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1">Shop Recipes</button>
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Admin Panel 🛠️</button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button onClick={() => navigate('/doctor')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Doctor Panel 🩺</button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-4 md:col-span-3 justify-end">
            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
                {user.first_name || 'User'}
              </span>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 relative text-paper"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-paprika text-paperLight font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {totalCartQuantity}
                </span>
              )}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
        {/* Left Column - Pet List Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-1">
            <Eyebrow label="VETERINARY REGISTERED PET PROFILE" />
            <h2 className="font-display font-bold text-3xl text-ink">
              Your Sourced Pets
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Browse pet profiles, adjust weights, and check active veterinarian records.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                Reading profiles...
              </p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto border border-paprika bg-paperLight p-8 rounded-sm text-center shadow-md">
              <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
              <h4 className="font-display font-bold text-lg text-ink mb-2">Failed to Load Profiles</h4>
              <p className="font-body text-xs text-ink opacity-80">
                Please check your internet connection or login status.
              </p>
            </div>
          ) : !pets || pets.length === 0 ? (
            <div className="border border-cardboard bg-paperLight border-dashed p-10 rounded-sm text-center">
              <PawPrint className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
              <h4 className="font-display font-bold text-lg text-ink mb-1">No Registered Pets</h4>
              <p className="font-body text-xs text-ink opacity-70 max-w-xs mx-auto">
                Your profile is blank. Fill in the registry on the right to add your companion dog or cat!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {pets.map((pet) => (
                <div 
                  key={pet.id} 
                  className="bg-paperLight border border-cardboard p-5 rounded-sm shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Ledger Spine binding card motif */}
                  <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

                  <div className="space-y-3 pl-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-[8px] uppercase font-bold text-herb block">PET PROFILE #{pet.id}</span>
                        <h4 className="font-display font-bold text-xl text-ink">🐾 {pet.name}</h4>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(pet.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-paprika opacity-70 hover:opacity-100 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 font-mono text-[10px] uppercase text-ink pr-4">
                      {/* Dotted parameters breakdown */}
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <PawPrint className="w-3 h-3 text-turmeric mr-1.5 animate-pulse" />
                          <span>SPECIES</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold">{pet.species}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Award className="w-3 h-3 text-turmeric mr-1.5 hover:rotate-12 transition-transform duration-300" />
                          <span>BREED</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold truncate max-w-[120px]">{pet.breed || 'MIXED'}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Heart className="w-3 h-3 text-paprika mr-1.5 animate-pulse" />
                          <span>GENDER</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold">{pet.gender || 'UNKNOWN'}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Scale className="w-3 h-3 text-herb mr-1.5 hover:-rotate-12 transition-transform duration-300" />
                          <span>WEIGHT</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold">{pet.weight ? `${pet.weight} KG` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Cake className="w-3 h-3 text-paprika mr-1.5 animate-bounce" style={{ animationDuration: '2.5s' }} />
                          <span>BIRTHDAY</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold">{pet.date_of_birth ? new Date(pet.date_of_birth).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Add Pet Form */}
        <div className="lg:col-span-5">
          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
            {/* Page Tab */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              REGISTRY FORM
            </div>

            <div className="space-y-1">
              <Eyebrow label="STEP 1 OF 1 — ADD COMPANION" />
              <h3 className="font-display font-bold text-xl text-ink">
                Pet Sourcing Registry
              </h3>
              <p className="font-body text-xs text-ink opacity-75 leading-relaxed">
                Add pet variables to calculate correct food nutrition percentages.
              </p>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            <form onSubmit={handleAddPet} className="space-y-4">
              {/* Pet Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-turmeric animate-pulse" />
                  <span>Pet Name:</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Scooby"
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Species & Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="species" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Dna className="w-3.5 h-3.5 text-turmeric animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Species:</span>
                  </label>
                  <select
                    id="species"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  >
                    <option value="Dog">Dog 🐶</option>
                    <option value="Cat">Cat 🐱</option>
                    <option value="Bird">Bird 🦜</option>
                    <option value="Rabbit">Rabbit 🐰</option>
                    <option value="Other">Other 🐾</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="gender" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Heart className="w-3.5 h-3.5 text-paprika animate-pulse" />
                    <span>Gender:</span>
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              {/* Breed */}
              <div className="space-y-1.5">
                <label htmlFor="breed" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-turmeric hover:rotate-12 transition-transform duration-300" />
                  <span>Breed Name:</span>
                </label>
                <input
                  type="text"
                  id="breed"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="e.g. Golden Retriever (optional)"
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  disabled={isSubmitting}
                />
              </div>

              {/* DOB & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="dob" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Cake className="w-3.5 h-3.5 text-paprika animate-bounce" style={{ animationDuration: '2s' }} />
                    <span>Birthday:</span>
                  </label>
                  <input
                    type="date"
                    id="dob"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="weight" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Scale className="w-3.5 h-3.5 text-herb hover:-rotate-12 transition-transform duration-300" />
                    <span>Weight (kg):</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    id="weight"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 12.5"
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                    min="0.1"
                  />
                </div>
              </div>

              {formError && (
                <div className="border border-paprika border-opacity-35 bg-red-50 p-3 rounded-sm flex items-start space-x-2 text-paprika font-body text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Register Pet Profile 🐾</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      </div>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
