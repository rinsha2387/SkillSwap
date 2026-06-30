const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { async } = require('q');

const userSchema = new mongoose.Schema({
    name: {type:String, required:true},
    email:{type:String ,required:true, unique:true},
    password:{type:String},
    googleId:{type:String,default:null},
    githubId:{type:String,default:null},
    profilePic :{type:String , default:''},
    bio :{type:String , default:''},
    skillsOffered: {type: [String],default: [] },
    skillsWanted: {type: [String],default: []},
    availability: {
      days: { type: [String], default: [] },
      from: { type: String, default: '' },
      to: { type: String, default: '' }
     },
    role:{ type: String, enum: ['user', 'admin'], default: 'user' },
    isBanned: { type: Boolean, default: false },
    verifications: {
    linkedinUrl: { type: String, default: '' },     
    githubUrl:   { type: String, default: '' },
    certificate: { type: String, default: '' },
    isVerified:  { type: Boolean, default: false }
    },
    completedSwaps: { type: Number, default: 0 },
    profileComplete: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 }
    }, { timestamps: true });


    userSchema.pre('save', async function () {
    if (!this.password) return;
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

   userSchema.methods.comparePassword = async function (enteredPassword) {
    if (!this.password) return false;
    return bcrypt.compare(enteredPassword, this.password);
};

    module.exports = mongoose.model('user' , userSchema);

    
