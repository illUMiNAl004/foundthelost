/**
 * ReportLostItem Component
 * 4-step form for reporting lost items
 * Steps: 1. Category & Description, 2. Location, 3. Details, 4. Review & Submit
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer as LeafletMap, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { CATEGORIES, ITEM_COLORS, CONDITIONS, CAMPUS_BUILDINGS, UMASS_CENTER, sanitizeInput } from '../../utils/constants';
import { findMatchesForLostItem, createMatchRecords } from '../../utils/matchingService';
import FormStep, { FormInput, FormTextarea, FormSelect, FormRadioGroup } from './FormStep';
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

const ReportLostItem = ({ onClose, initialLocation = null }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    // Step 1: Category & Description
    category: '',
    title: '',
    description: '',
    
    // Category-specific fields
    spire_id: '',      // For UCARD
    full_name: '',     // For ID
    owner_dob: '',     // For ID (Date of Birth)
    
    // Step 2: Location
    location_lat: initialLocation?.lat || null,
    location_lng: initialLocation?.lng || null,
    building_name: '',
    location_description: '',
    
    // Step 3: Details
    color: '',
    brand: '',
    condition: '',
    lost_date: new Date().toISOString().split('T')[0],
    lost_time: '',
    reward_offered: false,
    reward_amount: '',
  });
  
  const [errors, setErrors] = useState({});
  
  // Update form field
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);
  
  // Handle photo upload
  const handlePhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
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
  
  // Remove photo
  const removePhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview(null);
  }, []);
  
  // Validate current step
  const validateStep = useCallback((step) => {
    const newErrors = {};
    
    switch (step) {
      case 1:
        if (!formData.category) newErrors.category = 'Please select a category';
        
        // Category-specific validation
        if (formData.category === 'ucard') {
          if (!formData.spire_id.trim()) newErrors.spire_id = 'Please enter your SPIRE ID';
          else if (!/^\d{8}$/.test(formData.spire_id.trim())) newErrors.spire_id = 'SPIRE ID must be exactly 8 digits';
        } else if (formData.category === 'id') {
          if (!formData.full_name.trim()) newErrors.full_name = 'Please enter the full name on the ID';
          if (!formData.owner_dob) newErrors.owner_dob = 'Please enter the date of birth on the ID';
        } else if (formData.category) {
          if (!formData.title.trim()) newErrors.title = 'Please enter a title';
          if (formData.title.trim().length < 3) newErrors.title = 'Title must be at least 3 characters';
        }
        break;
        
      case 2:
        if (!formData.location_lat || !formData.location_lng) {
          newErrors.location = 'Please select a location on the map';
        }
        if (!formData.building_name) newErrors.building_name = 'Please select a building';
        break;
        
      case 3:
        if (!formData.lost_date) newErrors.lost_date = 'Please select when you lost the item';
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);
  
  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, validateStep]);
  
  // Handle previous step
  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => prev - 1);
  }, []);
  
  // Handle location selection from map
  const handleLocationSelect = useCallback((lat, lng) => {
    updateField('location_lat', lat);
    updateField('location_lng', lng);
    setIsSelectingLocation(false);
    setErrors(prev => ({ ...prev, location: null }));
  }, [updateField]);
  
  // Upload photo to Supabase storage
  const uploadPhoto = async () => {
    if (!photoFile) return null;
    
    const fileExt = photoFile.name.split('.').pop();
    const fileName = `lost/${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('item-photos')
      .upload(fileName, photoFile);
      
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('item-photos')
      .getPublicUrl(fileName);
      
    return publicUrl;
  };
  
  // Submit form
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    
    try {
      // Upload photo if provided
      let photoUrl = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }
      
      // Generate item name and description based on category
      let itemName = '';
      let itemDescription = '';
      
      if (formData.category === 'ucard') {
        itemName = 'UCard';
        itemDescription = `SPIRE ID: ${formData.spire_id.trim()}`;
      } else if (formData.category === 'id') {
        itemName = `ID - ${formData.full_name.trim()}`;
        itemDescription = `Name: ${formData.full_name.trim()}, DOB: ${formData.owner_dob}`;
      } else {
        itemName = formData.title.trim();
        itemDescription = formData.description.trim();
      }
      
      // Prepare lost item data - map form fields to database columns
      const lostItemData = {
        user_id: user.id,
        category: formData.category,
        item_name: sanitizeInput(itemName),
        description: sanitizeInput(itemDescription),
        latitude: formData.location_lat,
        longitude: formData.location_lng,
        building: formData.building_name,
        location_description: sanitizeInput(formData.location_description?.trim() || ''),
        color: formData.color || null,
        brand: sanitizeInput(formData.brand?.trim() || ''),
        condition: formData.condition || null,
        date_lost: formData.lost_date,
        time_lost: formData.lost_time || null,
        photo_url: photoUrl,
        reward_offered: formData.reward_offered,
        reward_amount: formData.reward_offered && formData.reward_amount ? formData.reward_amount : null,
        status: 'searching',
        // Category-specific fields
        spire_id: formData.category === 'ucard' ? formData.spire_id.trim() : null,
        owner_name: formData.category === 'id' ? sanitizeInput(formData.full_name.trim()) : null,
        owner_dob: formData.category === 'id' ? formData.owner_dob : null,
      };
      
      // Insert lost item using direct API call with user's auth token
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
      
      const response = await fetch(`${supabaseUrl}/rest/v1/lost_items`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(lostItemData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to insert item');
      }
      
      const newItemArray = await response.json();
      const newItem = Array.isArray(newItemArray) ? newItemArray[0] : newItemArray;
      
      // 🔍 Find potential matches with existing found items
      let matchCount = 0;
      try {
        // Fetch all available found items
        const foundResponse = await fetch(
          `${supabaseUrl}/rest/v1/found_items?status=in.(available,with_finder,deposited)&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        if (foundResponse.ok) {
          const foundItems = await foundResponse.json();
          const matches = findMatchesForLostItem(newItem, foundItems);
          
          if (matches.length > 0) {
            // Create match records in database
            await createMatchRecords(matches, 'lost', newItem.id);
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
          const foundResponse2 = await fetch(
            `${supabaseUrl}/rest/v1/found_items?status=in.(available,with_finder,deposited)&select=*`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
          if (foundResponse2.ok) {
            const foundItems2 = await foundResponse2.json();
            matchesForDisplay = findMatchesForLostItem(newItem, foundItems2);
          }
        } catch (e) {
          console.error('Error getting matches for display:', e);
        }
      }
      
      // Show toast
      if (matchCount > 0) {
        toast.success(`🎉 Found ${matchCount} potential match${matchCount > 1 ? 'es' : ''}!`);
      } else {
        toast.success('Lost item reported successfully!');
      }
      
      // Navigate to success page
      if (onClose) {
        onClose();
      } else {
        navigate('/report/success', { 
          state: { 
            item: newItem, 
            matches: matchesForDisplay,
            itemType: 'lost' 
          } 
        });
      }
      
    } catch (error) {
      toast.error(error.message || 'Failed to report lost item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Step 1: Category & Description
  const renderStep1 = () => (
    <div className="space-y-6">
      <FormSelect
        label="Category"
        value={formData.category}
        onChange={(e) => {
          updateField('category', e.target.value);
          // Clear category-specific fields when changing category
          updateField('spire_id', '');
          updateField('full_name', '');
          updateField('owner_dob', '');
          updateField('title', '');
          updateField('description', '');
        }}
        error={errors.category}
        required
      >
        <option value="">Select a category</option>
        {CATEGORIES.map(cat => (
          <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
        ))}
      </FormSelect>
      
      {/* Dynamic fields based on category */}
      {formData.category === 'ucard' ? (
        // UCARD: Show only SPIRE ID field
        <FormInput
          label="SPIRE ID"
          placeholder="Enter your 8-digit SPIRE ID"
          value={formData.spire_id}
          onChange={(e) => updateField('spire_id', e.target.value)}
          error={errors.spire_id}
          hint="Your SPIRE ID is an 8-digit number found on your UCard"
          required
        />
      ) : formData.category === 'id' ? (
        // ID: Show Full Name and Date of Birth fields
        <>
          <FormInput
            label="Full Name on ID"
            placeholder="Enter the full name as shown on the ID"
            value={formData.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            error={errors.full_name}
            hint="Enter the name exactly as it appears on the ID"
            required
          />
          <FormInput
            label="Date of Birth on ID"
            type="date"
            value={formData.owner_dob}
            onChange={(e) => updateField('owner_dob', e.target.value)}
            error={errors.owner_dob}
            required
          />
        </>
      ) : formData.category ? (
        // Wallet and other categories: Show standard fields
        <>
          <FormInput
            label="Item Title"
            placeholder="e.g., Black AirPods Pro with case"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            error={errors.title}
            hint="Be specific - include brand, color, distinguishing features"
            required
          />
          
          <FormTextarea
            label="Description"
            placeholder="Describe your item in detail. Include any unique markings, stickers, damage, or identifiable features that would help someone recognize it..."
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            error={errors.description}
            rows={4}
          />
        </>
      ) : null}
      
      {/* Photo upload - only show for categories that need it (not UCARD or ID) */}
      {formData.category && formData.category !== 'ucard' && formData.category !== 'id' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Photo (recommended)
          </label>
          
          {photoPreview ? (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-800">
              <img
                src={photoPreview}
                alt="Item preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 hover:bg-slate-800/30 transition-colors">
              <svg className="w-10 h-10 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-slate-400">Click to upload a photo</span>
              <span className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
  
  // Step 2: Location
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Where did you lose it? <span className="text-red-400">*</span>
        </label>
        
        {formData.location_lat && formData.location_lng ? (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-emerald-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Location selected</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelectingLocation(true)}
              >
                Change
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Lat: {formData.location_lat.toFixed(6)}, Lng: {formData.location_lng.toFixed(6)}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSelectingLocation(true)}
            className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${
              errors.location
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
          >
            <svg className="w-10 h-10 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-slate-400">Tap to select location on map</span>
          </button>
        )}
        {errors.location && (
          <p className="text-sm text-red-400 mt-2">{errors.location}</p>
        )}
      </div>
      
      <FormSelect
        label="Building/Area"
        value={formData.building_name}
        onChange={(e) => updateField('building_name', e.target.value)}
        error={errors.building_name}
        required
      >
        <option value="">Select a building</option>
        {CAMPUS_BUILDINGS.map(building => (
          <option key={building.value} value={building.value}>{building.label}</option>
        ))}
      </FormSelect>
      
      <FormTextarea
        label="Location Details"
        placeholder="e.g., Second floor study room, near the windows..."
        value={formData.location_description}
        onChange={(e) => updateField('location_description', e.target.value)}
        rows={2}
        hint="Help others know exactly where to look"
      />
      
      {/* Inline map for location selection */}
      {isSelectingLocation && (
        <LocationPicker
          initialLocation={{
            lat: formData.location_lat || UMASS_CENTER.lat,
            lng: formData.location_lng || UMASS_CENTER.lng
          }}
          onSelect={handleLocationSelect}
          onCancel={() => setIsSelectingLocation(false)}
        />
      )}
    </div>
  );
  
  // Step 3: Details
  const renderStep3 = () => (
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
          placeholder="e.g., Apple, Nike"
          value={formData.brand}
          onChange={(e) => updateField('brand', e.target.value)}
        />
      </div>
      
      <FormSelect
        label="Condition"
        value={formData.condition}
        onChange={(e) => updateField('condition', e.target.value)}
      >
        <option value="">Select condition</option>
        {CONDITIONS.map(cond => (
          <option key={cond.value} value={cond.value}>{cond.label}</option>
        ))}
      </FormSelect>
      
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Date Lost"
          type="date"
          value={formData.lost_date}
          onChange={(e) => updateField('lost_date', e.target.value)}
          error={errors.lost_date}
          max={new Date().toISOString().split('T')[0]}
          required
        />
        
        <FormInput
          label="Approximate Time"
          type="time"
          value={formData.lost_time}
          onChange={(e) => updateField('lost_time', e.target.value)}
        />
      </div>
      
      {/* Reward section */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-300">Offer a reward?</label>
          <button
            type="button"
            onClick={() => updateField('reward_offered', !formData.reward_offered)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              formData.reward_offered ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                formData.reward_offered ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
        
        {formData.reward_offered && (
          <FormInput
            label="Reward Amount"
            type="number"
            placeholder="Enter amount in USD"
            value={formData.reward_amount}
            onChange={(e) => updateField('reward_amount', e.target.value)}
            min="0"
            step="1"
          />
        )}
      </div>
    </div>
  );
  
  // Step 4: Review
  const renderStep4 = () => (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardContent className="p-4">
          <h4 className="font-semibold text-slate-200 mb-3">Review Your Report</h4>
          
          {photoPreview && (
            <div className="mb-4 rounded-lg overflow-hidden">
              <img src={photoPreview} alt="Item" className="w-full h-40 object-cover" />
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
              <dt className="text-slate-400">Building:</dt>
              <dd className="text-slate-200">
                {CAMPUS_BUILDINGS.find(b => b.value === formData.building_name)?.label || '-'}
              </dd>
            </div>
            
            <div className="flex justify-between">
              <dt className="text-slate-400">Date Lost:</dt>
              <dd className="text-slate-200">{formData.lost_date}</dd>
            </div>
            
            {formData.color && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Color:</dt>
                <dd className="text-slate-200">
                  {ITEM_COLORS.find(c => c.value === formData.color)?.label || '-'}
                </dd>
              </div>
            )}
            
            {formData.brand && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Brand:</dt>
                <dd className="text-slate-200">{formData.brand}</dd>
              </div>
            )}
            
            {formData.reward_offered && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Reward:</dt>
                <dd className="text-emerald-400 font-medium">
                  ${formData.reward_amount || '0'}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      
      <p className="text-xs text-slate-400 text-center">
        By submitting, you confirm this information is accurate and you agree to our terms of service.
      </p>
    </div>
  );
  
  const steps = [
    { title: 'Item Info', description: 'What did you lose?' },
    { title: 'Location', description: 'Where did you lose it?' },
    { title: 'Details', description: 'Additional information' },
    { title: 'Review', description: 'Confirm your report' },
  ];
  
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
          
          <h1 className="text-lg font-semibold text-white">Report Lost Item</h1>
          
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        {/* Progress bar */}
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
                  className={`w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center text-sm font-medium ${
                    index + 1 < currentStep
                      ? 'bg-emerald-500 text-white'
                      : index + 1 === currentStep
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {index + 1 < currentStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          
          {/* Progress line */}
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Form content */}
      <div className="p-4 max-w-lg mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">{steps[currentStep - 1].title}</h2>
          <p className="text-sm text-slate-400">{steps[currentStep - 1].description}</p>
        </div>
        
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
      
      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 1 && (
            <Button
              variant="secondary"
              onClick={handlePrevious}
              className="flex-1"
            >
              Back
            </Button>
          )}
          
          {currentStep < steps.length ? (
            <Button
              variant="lost"
              onClick={handleNext}
              className="flex-1"
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="lost"
              onClick={handleSubmit}
              loading={isSubmitting}
              className="flex-1"
            >
              Submit Report
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * LocationPicker Component
 * Real map for selecting location using Leaflet with current location support
 */
const LocationPicker = ({ initialLocation, onSelect, onCancel }) => {
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white font-medium"
          >
            Cancel
          </button>
          <h3 className="font-semibold text-white">Select Location</h3>
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

export default ReportLostItem;
