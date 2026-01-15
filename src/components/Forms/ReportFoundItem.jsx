/**
 * ReportFoundItem Component
 * Multi-step form with 2 paths:
 * Path 1: "I have it with me" - item stays with finder
 * Path 2: "I left it somewhere" - item deposited at location
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer as LeafletMap, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { CATEGORIES, ITEM_COLORS, CAMPUS_BUILDINGS, UMASS_CENTER, sanitizeInput } from '../../utils/constants';
import { findMatchesForFoundItem, createMatchRecords } from '../../utils/matchingService';
import { FormInput, FormTextarea, FormSelect } from './FormStep';
import { Card, CardContent } from '../Common/Card';
import Button from '../Common/Button';

// Custom marker icon for location picker
const locationIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map click handler component
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng);
    },
  });
  return null;
};

// Steps for "With Me" path
const WITH_ME_STEPS = [
  { title: 'Item Info', description: 'What did you find?' },
  { title: 'Found Location', description: 'Where did you find it?' },
  { title: 'Details', description: 'Additional information' },
  { title: 'Review', description: 'Confirm your report' },
];

// Steps for "Left It" path
const LEFT_IT_STEPS = [
  { title: 'Item Info', description: 'What did you find?' },
  { title: 'Found Location', description: 'Where did you find it?' },
  { title: 'Current Location', description: 'Where did you leave it?' },
  { title: 'Details', description: 'Additional information' },
  { title: 'Review', description: 'Confirm your report' },
];

const ReportFoundItem = ({ onClose, initialLocation = null }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();
  
  // Path selection: null = not selected, 'withMe' = carrying it, 'leftIt' = deposited
  const [selectedPath, setSelectedPath] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // 0 = path selection
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(null); // 'found' or 'current'
  
  // Form data state
  const [formData, setFormData] = useState({
    // Item info
    category: '',
    title: '',
    description: '',
    
    // Found location
    found_location_lat: initialLocation?.lat || null,
    found_location_lng: initialLocation?.lng || null,
    found_building_name: '',
    found_location_description: '',
    found_date: new Date().toISOString().split('T')[0],
    
    // Current location (only for "left it" path)
    current_location_lat: null,
    current_location_lng: null,
    current_building_name: '',
    current_location_description: '',
    
    // Details
    color: '',
    brand: '',
    
    // Contact preferences (only for "with me" path)
    contact_method: 'app', // 'app', 'email', 'both'
  });
  
  const [errors, setErrors] = useState({});
  
  const steps = selectedPath === 'withMe' ? WITH_ME_STEPS : LEFT_IT_STEPS;
  
  // Update form field
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);
  
  // Handle photo upload
  const handlePhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, [toast]);
  
  const removePhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview(null);
  }, []);
  
  // Get current step index within the selected path
  const getStepIndex = () => {
    if (selectedPath === 'withMe') {
      return currentStep; // 1-4
    } else {
      return currentStep; // 1-5
    }
  };
  
  // Validate current step
  const validateStep = useCallback((step) => {
    const newErrors = {};
    
    if (selectedPath === 'withMe') {
      switch (step) {
        case 1: // Item Info
          if (!formData.category) newErrors.category = 'Please select a category';
          if (!formData.title.trim()) newErrors.title = 'Please enter a title';
          if (formData.title.trim().length < 3) newErrors.title = 'Title must be at least 3 characters';
          break;
          
        case 2: // Found Location
          if (!formData.found_location_lat || !formData.found_location_lng) {
            newErrors.found_location = 'Please select where you found the item';
          }
          if (!formData.found_building_name) newErrors.found_building_name = 'Please select a building';
          if (!formData.found_date) newErrors.found_date = 'Please select when you found it';
          break;
          
        case 3: // Details - optional fields, no validation needed
          break;
          
        default:
          break;
      }
    } else { // leftIt path
      switch (step) {
        case 1: // Item Info
          if (!formData.category) newErrors.category = 'Please select a category';
          if (!formData.title.trim()) newErrors.title = 'Please enter a title';
          break;
          
        case 2: // Found Location
          if (!formData.found_location_lat || !formData.found_location_lng) {
            newErrors.found_location = 'Please select where you found the item';
          }
          if (!formData.found_building_name) newErrors.found_building_name = 'Please select a building';
          break;
          
        case 3: // Current Location
          if (!formData.current_location_lat || !formData.current_location_lng) {
            newErrors.current_location = 'Please select where you left the item';
          }
          if (!formData.current_building_name) newErrors.current_building_name = 'Please select where you left it';
          break;
          
        case 4: // Details - optional
          break;
          
        default:
          break;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, selectedPath]);
  
  // Handle path selection
  const handlePathSelect = (path) => {
    setSelectedPath(path);
    setCurrentStep(1);
  };
  
  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, validateStep]);
  
  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep === 1) {
      setSelectedPath(null);
      setCurrentStep(0);
    } else {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);
  
  // Handle location selection
  const handleLocationSelect = useCallback((lat, lng, type) => {
    if (type === 'found') {
      updateField('found_location_lat', lat);
      updateField('found_location_lng', lng);
      setErrors(prev => ({ ...prev, found_location: null }));
    } else {
      updateField('current_location_lat', lat);
      updateField('current_location_lng', lng);
      setErrors(prev => ({ ...prev, current_location: null }));
    }
    setIsSelectingLocation(null);
  }, [updateField]);
  
  // Upload photo
  const uploadPhoto = async () => {
    if (!photoFile) return null;
    
    const fileExt = photoFile.name.split('.').pop();
    const fileName = `found/${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('item-photos')
      .upload(fileName, photoFile);
      
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('item-photos')
      .getPublicUrl(fileName);
      
    return publicUrl;
  };
  
  // Submit form
  const handleSubmit = async () => {
    const lastStep = selectedPath === 'withMe' ? 4 : 5;
    if (currentStep !== lastStep) return;
    
    setIsSubmitting(true);
    
    try {
      let photoUrl = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }
      
      // Determine status based on path
      const status = selectedPath === 'withMe' ? 'with_finder' : 'deposited';
      
      // Prepare found item data - map form fields to database columns
      const foundItemData = {
        finder_id: user.id,
        category: formData.category,
        item_name: sanitizeInput(formData.title.trim()),
        description: sanitizeInput(formData.description.trim()),
        
        // Location (for display on map) - use database column names
        latitude: selectedPath === 'withMe' 
          ? formData.found_location_lat 
          : formData.current_location_lat,
        longitude: selectedPath === 'withMe' 
          ? formData.found_location_lng 
          : formData.current_location_lng,
        building: selectedPath === 'withMe'
          ? formData.found_building_name
          : formData.current_building_name,
        location_description: selectedPath === 'withMe'
          ? sanitizeInput(formData.found_location_description?.trim() || '')
          : sanitizeInput(formData.current_location_description?.trim() || ''),
        
        // Date found
        date_found: formData.found_date,
        
        // Details
        color: formData.color || null,
        brand: sanitizeInput(formData.brand?.trim() || ''),
        photo_url: photoUrl,
        
        // Status
        status: status,
        is_carrying: selectedPath === 'withMe',
        deposit_location: selectedPath !== 'withMe' ? formData.current_building_name : null,
      };
      
      // Insert found item using direct API call with user's auth token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Get the user's access token from the session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || supabaseKey;
      
      // First, ensure user exists in users table
      const userCheckResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      const existingUser = await userCheckResponse.json();
      
      if (!existingUser || existingUser.length === 0) {
        // Create user profile
        await fetch(`${supabaseUrl}/rest/v1/users`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          }),
        });
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/found_items`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(foundItemData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to insert item');
      }
      
      const newItemArray = await response.json();
      const newItem = Array.isArray(newItemArray) ? newItemArray[0] : newItemArray;
      
      // 🔍 Find potential matches with existing lost items
      let matchCount = 0;
      try {
        // Fetch all active lost items
        const lostResponse = await fetch(
          `${supabaseUrl}/rest/v1/lost_items?status=in.(searching,in_discussion)&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        if (lostResponse.ok) {
          const lostItems = await lostResponse.json();
          const matches = findMatchesForFoundItem(newItem, lostItems);
          
          if (matches.length > 0) {
            // Create match records in database
            await createMatchRecords(matches, 'found', newItem.id);
            matchCount = matches.length;
            console.log(`✅ Found ${matchCount} potential matches!`, matches);
          }
        }
      } catch (matchError) {
        console.error('Matching error (non-critical):', matchError);
      }
      
      // Get matches for display on success page
      let matchesForDisplay = [];
      if (matchCount > 0) {
        try {
          const lostResponse2 = await fetch(
            `${supabaseUrl}/rest/v1/lost_items?status=in.(searching,in_discussion)&select=*`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
          if (lostResponse2.ok) {
            const lostItems2 = await lostResponse2.json();
            matchesForDisplay = findMatchesForFoundItem(newItem, lostItems2);
          }
        } catch (e) {
          console.error('Error getting matches for display:', e);
        }
      }
      
      // Show toast
      if (matchCount > 0) {
        toast.success(`🎉 Matched with ${matchCount} lost item${matchCount > 1 ? 's' : ''}!`);
      } else {
        toast.success('Found item reported! Thanks for helping!');
      }
      
      // Navigate to success page
      if (onClose) {
        onClose();
      } else {
        navigate('/report/success', { 
          state: { 
            item: newItem, 
            matches: matchesForDisplay,
            itemType: 'found' 
          } 
        });
      }
      
    } catch (error) {
      toast.error(error.message || 'Failed to report found item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render path selection screen
  const renderPathSelection = () => (
    <div className="p-4 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">You found something!</h2>
        <p className="text-slate-400">Thank you for helping. What would you like to do with the item?</p>
      </div>
      
      <div className="space-y-4">
        {/* Option 1: With Me */}
        <button
          onClick={() => handlePathSelect('withMe')}
          className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-5 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">I have it with me</h3>
              <p className="text-sm text-slate-400">
                Keep the item and wait for the owner to contact you. You'll earn more karma points!
              </p>
              <div className="mt-2 flex items-center text-emerald-400 text-sm font-medium">
                <span>+15 karma points</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </button>
        
        {/* Option 2: Left It */}
        <button
          onClick={() => handlePathSelect('leftIt')}
          className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-5 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/30 transition-colors">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">I left it somewhere</h3>
              <p className="text-sm text-slate-400">
                Report where you found it and where you left it (e.g., lost and found desk).
              </p>
              <div className="mt-2 flex items-center text-emerald-400 text-sm font-medium">
                <span>+10 karma points</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
  
  // Render item info step
  const renderItemInfo = () => (
    <div className="space-y-6">
      <FormSelect
        label="Category"
        value={formData.category}
        onChange={(e) => updateField('category', e.target.value)}
        error={errors.category}
        required
      >
        <option value="">Select a category</option>
        {CATEGORIES.map(cat => (
          <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
        ))}
      </FormSelect>
      
      <FormInput
        label="Item Title"
        placeholder="e.g., Black iPhone 15 Pro"
        value={formData.title}
        onChange={(e) => updateField('title', e.target.value)}
        error={errors.title}
        hint="Describe what you found briefly"
        required
      />
      
      <FormTextarea
        label="Description"
        placeholder="Describe the item. Include any identifying features like stickers, cases, scratches, etc..."
        value={formData.description}
        onChange={(e) => updateField('description', e.target.value)}
        error={errors.description}
        rows={3}
      />
      
      {/* Photo upload */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Photo (helps with matching)
        </label>
        
        {photoPreview ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-800">
            <img src={photoPreview} alt="Item" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 hover:bg-slate-800/30 transition-colors">
            <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-slate-400">Add a photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
  
  // Render found location step
  const renderFoundLocation = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Where did you find it? <span className="text-red-400">*</span>
        </label>
        
        {formData.found_location_lat && formData.found_location_lng ? (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-emerald-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Found location selected</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelectingLocation('found')}
              >
                Change
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSelectingLocation('found')}
            className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${
              errors.found_location
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
          >
            <svg className="w-10 h-10 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="text-slate-400">Tap to select location on map</span>
          </button>
        )}
        {errors.found_location && (
          <p className="text-sm text-red-400 mt-2">{errors.found_location}</p>
        )}
      </div>
      
      <FormSelect
        label="Building/Area"
        value={formData.found_building_name}
        onChange={(e) => updateField('found_building_name', e.target.value)}
        error={errors.found_building_name}
        required
      >
        <option value="">Select a building</option>
        {CAMPUS_BUILDINGS.map(building => (
          <option key={building.value} value={building.value}>{building.label}</option>
        ))}
      </FormSelect>
      
      <FormTextarea
        label="Location Details"
        placeholder="e.g., Found on a bench near the entrance..."
        value={formData.found_location_description}
        onChange={(e) => updateField('found_location_description', e.target.value)}
        rows={2}
      />
      
      <FormInput
        label="Date Found"
        type="date"
        value={formData.found_date}
        onChange={(e) => updateField('found_date', e.target.value)}
        error={errors.found_date}
        max={new Date().toISOString().split('T')[0]}
        required
      />
      
      {isSelectingLocation === 'found' && (
        <LocationPickerModal
          initialLocation={{
            lat: formData.found_location_lat || UMASS_CENTER.lat,
            lng: formData.found_location_lng || UMASS_CENTER.lng
          }}
          onSelect={(lat, lng) => handleLocationSelect(lat, lng, 'found')}
          onCancel={() => setIsSelectingLocation(null)}
          title="Where did you find it?"
        />
      )}
    </div>
  );
  
  // Render current location step (only for "left it" path)
  const renderCurrentLocation = () => (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-amber-200 font-medium">Where is the item now?</p>
            <p className="text-xs text-amber-300/70 mt-1">
              This helps the owner find it. Common places: Lost & Found desk, building security, front desk.
            </p>
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Current item location <span className="text-red-400">*</span>
        </label>
        
        {formData.current_location_lat && formData.current_location_lng ? (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-emerald-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Current location selected</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelectingLocation('current')}
              >
                Change
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSelectingLocation('current')}
            className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${
              errors.current_location
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
          >
            <svg className="w-10 h-10 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="text-slate-400">Tap to select where you left it</span>
          </button>
        )}
        {errors.current_location && (
          <p className="text-sm text-red-400 mt-2">{errors.current_location}</p>
        )}
      </div>
      
      <FormSelect
        label="Building/Location"
        value={formData.current_building_name}
        onChange={(e) => updateField('current_building_name', e.target.value)}
        error={errors.current_building_name}
        required
      >
        <option value="">Select where you left it</option>
        {CAMPUS_BUILDINGS.map(building => (
          <option key={building.value} value={building.value}>{building.label}</option>
        ))}
      </FormSelect>
      
      <FormTextarea
        label="Specific Location"
        placeholder="e.g., Gave to the security desk on the first floor..."
        value={formData.current_location_description}
        onChange={(e) => updateField('current_location_description', e.target.value)}
        rows={2}
        hint="Be specific so the owner can find it"
      />
      
      {isSelectingLocation === 'current' && (
        <LocationPickerModal
          initialLocation={{
            lat: formData.current_location_lat || UMASS_CENTER.lat,
            lng: formData.current_location_lng || UMASS_CENTER.lng
          }}
          onSelect={(lat, lng) => handleLocationSelect(lat, lng, 'current')}
          onCancel={() => setIsSelectingLocation(null)}
          title="Where is the item now?"
        />
      )}
    </div>
  );
  
  // Render details step
  const renderDetails = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <FormSelect
          label="Color"
          value={formData.color}
          onChange={(e) => updateField('color', e.target.value)}
        >
          <option value="">Select color</option>
          {ITEM_COLORS.map(color => (
            <option key={color.value} value={color.value}>{color.label}</option>
          ))}
        </FormSelect>
        
        <FormInput
          label="Brand"
          placeholder="e.g., Apple"
          value={formData.brand}
          onChange={(e) => updateField('brand', e.target.value)}
        />
      </div>
      
      {/* Contact preferences for "with me" path */}
      {selectedPath === 'withMe' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            How should the owner contact you?
          </label>
          <div className="space-y-2">
            {[
              { id: 'app', label: 'Through the app (recommended)', desc: 'Keep your email private' },
              { id: 'email', label: 'Share my email', desc: 'Owner can email you directly' },
              { id: 'both', label: 'Both app and email', desc: 'Maximum flexibility' },
            ].map(option => (
              <label
                key={option.id}
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.contact_method === option.id
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="contact_method"
                  value={option.id}
                  checked={formData.contact_method === option.id}
                  onChange={(e) => updateField('contact_method', e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="text-sm text-slate-200">{option.label}</p>
                  <p className="text-xs text-slate-400">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  // Render review step
  const renderReview = () => (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              selectedPath === 'withMe' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {selectedPath === 'withMe' ? 'With Finder' : 'Deposited'}
            </span>
          </div>
          
          {photoPreview && (
            <div className="mb-4 rounded-lg overflow-hidden">
              <img src={photoPreview} alt="Item" className="w-full h-32 object-cover" />
            </div>
          )}
          
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Category:</dt>
              <dd className="text-slate-200">
                {CATEGORIES.find(c => c.value === formData.category)?.label || '-'}
              </dd>
            </div>
            
            <div className="flex justify-between">
              <dt className="text-slate-400">Title:</dt>
              <dd className="text-slate-200">{formData.title}</dd>
            </div>
            
            <div>
              <dt className="text-slate-400 mb-1">Description:</dt>
              <dd className="text-slate-200 text-xs bg-slate-800/50 p-2 rounded">
                {formData.description}
              </dd>
            </div>
            
            <div className="flex justify-between">
              <dt className="text-slate-400">Found at:</dt>
              <dd className="text-slate-200">
                {CAMPUS_BUILDINGS.find(b => b.value === formData.found_building_name)?.label || '-'}
              </dd>
            </div>
            
            {selectedPath === 'leftIt' && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Left at:</dt>
                <dd className="text-slate-200">
                  {CAMPUS_BUILDINGS.find(b => b.value === formData.current_building_name)?.label || '-'}
                </dd>
              </div>
            )}
            
            <div className="flex justify-between">
              <dt className="text-slate-400">Date Found:</dt>
              <dd className="text-slate-200">{formData.found_date}</dd>
            </div>
            
            {formData.color && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Color:</dt>
                <dd className="text-slate-200">
                  {ITEM_COLORS.find(c => c.value === formData.color)?.label || '-'}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">
            You'll earn {selectedPath === 'withMe' ? '+15' : '+10'} karma points!
          </span>
        </div>
      </div>
      
      <p className="text-xs text-slate-400 text-center">
        By submitting, you confirm this information is accurate.
      </p>
    </div>
  );
  
  // Determine which step content to render
  const renderStepContent = () => {
    if (selectedPath === 'withMe') {
      switch (currentStep) {
        case 1: return renderItemInfo();
        case 2: return renderFoundLocation();
        case 3: return renderDetails();
        case 4: return renderReview();
        default: return null;
      }
    } else {
      switch (currentStep) {
        case 1: return renderItemInfo();
        case 2: return renderFoundLocation();
        case 3: return renderCurrentLocation();
        case 4: return renderDetails();
        case 5: return renderReview();
        default: return null;
      }
    }
  };
  
  const isLastStep = currentStep === steps.length;
  
  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onClose || (() => navigate(-1))}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h1 className="text-lg font-semibold text-white">Report Found Item</h1>
          
          <div className="w-10" />
        </div>
        
        {/* Progress bar - only show after path selection */}
        {selectedPath && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`flex-1 text-center text-xs ${
                    index + 1 < currentStep
                      ? 'text-emerald-400'
                      : index + 1 === currentStep
                      ? 'text-white'
                      : 'text-slate-500'
                  }`}
                >
                  <div
                    className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                      index + 1 < currentStep
                        ? 'bg-emerald-500 text-white'
                        : index + 1 === currentStep
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {index + 1 < currentStep ? (
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
            
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Content */}
      {currentStep === 0 ? (
        renderPathSelection()
      ) : (
        <div className="p-4 max-w-lg mx-auto">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">{steps[currentStep - 1].title}</h2>
            <p className="text-sm text-slate-400">{steps[currentStep - 1].description}</p>
          </div>
          
          {renderStepContent()}
        </div>
      )}
      
      {/* Bottom navigation - only show after path selection */}
      {selectedPath && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4">
          <div className="max-w-lg mx-auto flex gap-3">
            <Button
              variant="secondary"
              onClick={handlePrevious}
              className="flex-1"
            >
              Back
            </Button>
            
            {!isLastStep ? (
              <Button
                variant="found"
                onClick={handleNext}
                className="flex-1"
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="found"
                onClick={handleSubmit}
                loading={isSubmitting}
                className="flex-1"
              >
                Submit Report
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * LocationPickerModal Component
 * Real map modal for selecting location using Leaflet with current location support
 */
const LocationPickerModal = ({ initialLocation, onSelect, onCancel, title }) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  const handleMapClick = (latlng) => {
    setSelectedLocation({ lat: latlng.lat, lng: latlng.lng });
  };
  
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please select on the map.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-xl">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <button onClick={onCancel} className="text-slate-400 hover:text-white font-medium">
            Cancel
          </button>
          <h3 className="font-semibold text-white">{title}</h3>
          <button
            onClick={() => onSelect(selectedLocation.lat, selectedLocation.lng)}
            className="text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Confirm
          </button>
        </div>
        
        {/* Real Leaflet Map */}
        <div className="flex-1 relative">
          <LeafletMap
            center={[selectedLocation.lat, selectedLocation.lng]}
            zoom={16}
            className="h-full w-full"
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker 
              position={[selectedLocation.lat, selectedLocation.lng]}
              icon={locationIcon}
            />
            <MapClickHandler onLocationSelect={handleMapClick} />
          </LeafletMap>
          
          {/* Current Location Button */}
          <button
            onClick={handleUseCurrentLocation}
            disabled={gettingLocation}
            className="absolute bottom-4 right-4 z-[1000] bg-white text-slate-900 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {gettingLocation ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Getting location...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
                Use My Location
              </>
            )}
          </button>
          </div>
          
        {/* Footer with coordinates */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <p className="text-xs text-slate-400 text-center mb-1">
            📍 Tap on the map or use your current location
          </p>
          <p className="text-xs text-emerald-400 text-center font-mono">
            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportFoundItem;
