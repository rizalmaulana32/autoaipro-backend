const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  // User association
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // REINS ID
  reins_id: {
    type: String,
    required: true
  },

  // Location Information
  prefecture: String,
  city: String,
  town: String,
  addressDetail: String,
  buildingName: String,
  roomNumber: String,
  otherAddress: String,

  // Price Information
  rent: String,
  securityDeposit: String,
  keyMoney: String,
  guaranteeDeposit: String,
  rightMoney: String,
  managementFee: String,
  commonServiceFee: String,
  renewalFee: String,
  renewalType: String,
  contractPeriod: String,

  // Amortization
  amortizationCode: String,
  amortizationMonths: String,
  amortizationRate: String,

  // Area Information
  usableArea: String,
  balconyArea: String,
  areaMeasurementMethod: String,
  pricePerSqm: String,
  pricePerTsubo: String,

  // Transportation (3 routes)
  railwayLine1: String,
  station1: String,
  walkMinutes1: String,
  carMinutes1: String,
  busMinutes1: String,
  busStopWalk1: String,
  busRoute1: String,
  busStopName1: String,

  railwayLine2: String,
  station2: String,
  walkMinutes2: String,
  carMinutes2: String,
  busMinutes2: String,
  busStopWalk2: String,
  busRoute2: String,
  busStopName2: String,

  railwayLine3: String,
  station3: String,
  walkMinutes3: String,
  carMinutes3: String,
  busMinutes3: String,
  busStopWalk3: String,
  busRoute3: String,
  busStopName3: String,

  otherTransportation: String,

  // Layout Information
  layoutType: String,
  roomCount: String,
  layoutOther: String,

  // Building Information
  constructionDate: String,
  buildingStructure: String,
  aboveGroundFloors: String,
  undergroundFloors: String,
  floorLocation: String,
  balconyDirection: String,
  totalUnits: String,

  // Renovation
  renovationDate1: String,
  renovationHistory1: String,
  renovationDate2: String,
  renovationHistory2: String,

  // Management & Maintenance
  managementAssociation: String,
  managementFeeWithTax: String,

  // Other Fees
  otherFeeNone: String,
  otherFeeName1: String,
  otherFeeAmount1: String,
  otherFeeName2: String,
  otherFeeAmount2: String,
  otherMonthlyFeeName: String,
  otherMonthlyFeeAmount: String,

  // Parking
  parkingAvailable: String,
  parkingFee: String,
  parkingNote: String,

  // Property Type & Status
  propertyType: String,
  newConstructionFlag: String,
  adReprintStatus: String,
  realEstateIdBuilding: String,

  // Company Information
  companyName: String,
  companyPhone: String,
  inquiryPhone: String,
  contactPerson: String,
  contactPhone: String,
  contactEmail: String,
  internalManagementCode: String,

  // Rental Lease Information
  buildingLeaseType: String,
  buildingLeasePeriod: String,
  buildingLeaseRenewal: String,

  // Move-in & Occupancy
  moveInDate: String,
  moveInTiming: String,

  // Equipment & Amenities
  equipment: String,
  amenities: String,
  conditions: String,
  housingPerformance: String,

  // File paths
  files: {
    html_path: String,
    html_filename: String,
    floorplan_path: String,
    floorplan_filename: String,
    image_paths: [String],
    image_filenames: [String]
  },

  // Metadata
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
PropertySchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Property', PropertySchema);
