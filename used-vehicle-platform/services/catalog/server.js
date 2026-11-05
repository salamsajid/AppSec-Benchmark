/* UVP Vehicle Catalog - INTENTIONALLY VULNERABLE. LAB ONLY. DO NOT EXPOSE.
 * Sec 1.2: NoSQLi / GraphQL / deserialization / prototype pollution /
 *          uploads / traversal / race / business logic.
 */
'use strict';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const _ = require('lodash');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/catalog';

// VULN: extended query parser -> ?price[$gt]=1000 operator injection
app.set('query parser', 'extended');
// VULN: permissive CORS (reflect *, allow null) for CSRF/CORS labs
app.use(cors({ origin: (o, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '5mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, verify: (req, res, buf) => { if (!req.rawBody) req.rawBody = buf; } }));

// ensure traversal seed files exist (also created in Dockerfile)
try {
  if (!fs.existsSync(path.join(__dirname, 'secret.txt'))) fs.writeFileSync(path.join(__dirname, 'secret.txt'), 'LAB{traversal_secret_flag}\n');
  if (!fs.existsSync(path.join(__dirname, 'images', 'secret.txt'))) { try { fs.mkdirSync(path.join(__dirname, 'images'), { recursive: true }); } catch {} fs.writeFileSync(path.join(__dirname, 'images', 'secret.txt'), 'LAB{traversal_secret_flag}\n'); }
} catch {}

// ---------- in-memory seed (fallback + primary for deterministic labs) ----------
const users = [
  { username: 'administrator', password: 'admin123', role: 'admin', email: 'admin@used-vehicles.lab', ssn: '000-00-0001' },
  { username: 'carlos', password: 'montoya', role: 'user', email: 'carlos@used-vehicles.lab', ssn: '000-00-0002' },
  { username: 'wiener', password: 'peter', role: 'user', email: 'wiener@used-vehicles.lab', ssn: '000-00-0003' },
  { username: 'marcus.vance', password: 'Vance@2026Auto', role: 'dealer', email: 'marcus.vance@autohub.in', ssn: '000-00-0004' },
  { username: 'elena.rostova', password: 'ElenaPrime#99', role: 'dealer', email: 'elena.rostova@primemotors.in', ssn: '000-00-0005' },
  { username: 'david.kim', password: 'KimCityDrive$24', role: 'dealer', email: 'david.kim@citydrive.in', ssn: '000-00-0006' },
  { username: 'sarah.jenkins', password: 'SunriseSarah!1', role: 'dealer', email: 'sarah.jenkins@sunrisecars.in', ssn: '000-00-0007' },
  { username: 'raj.patel', password: 'GalaxyRaj*88', role: 'dealer', email: 'raj.patel@galaxyauto.in', ssn: '000-00-0008' },
  { username: 'vikram.mehta', password: 'ApexVikram@2026', role: 'dealer', email: 'vikram.mehta@apexluxury.in', ssn: '000-00-0009' },
  { username: 'priya.deshmukh', password: 'DeccanPriya#44', role: 'dealer', email: 'priya.deshmukh@deccancertified.com', ssn: '000-00-0010' },
  { username: 'anand.verma', password: 'HeritageAnand!9', role: 'dealer', email: 'anand.verma@heritageclassics.in', ssn: '000-00-0011' },
  { username: 'jordan.hayes', password: 'HayesExec!2026', role: 'executive', email: 'jordan.hayes@used-vehicles.lab', ssn: '000-00-0012' },
  { username: 'claire.redfield', password: 'RedfieldAudit#1', role: 'auditor', email: 'claire.redfield@used-vehicles.lab', ssn: '000-00-0013' },
  { username: 'alex.chen', password: 'ChenFinance$77', role: 'executive', email: 'alex.chen@uvpcapital.com', ssn: '000-00-0014' },
  { username: 'sophia.martinez', password: 'SophiaPricing%23', role: 'analyst', email: 'sophia.martinez@used-vehicles.lab', ssn: '000-00-0015' },
  { username: 'kevin.mitnick', password: 'GhostInWire#88', role: 'auditor', email: 'kevin.mitnick@security.lab', ssn: '000-00-0016' },
  { username: 'emily.watson', password: 'EmilyW@2026', role: 'user', email: 'emily.watson@gmail.com', ssn: '000-00-0017' },
  { username: 'michael.chang', password: 'ChangTech#12', role: 'user', email: 'michael.chang@outlook.com', ssn: '000-00-0018' },
  { username: 'olivia.taylor', password: 'OliviaT$99', role: 'user', email: 'olivia.taylor@icloud.com', ssn: '000-00-0019' },
  { username: 'lucas.silva', password: 'LucasSilva!7', role: 'user', email: 'lucas.silva@techcorp.io', ssn: '000-00-0020' },
  { username: 'arjun.sharma', password: 'ArjunS@Drive', role: 'user', email: 'arjun.sharma99@gmail.com', ssn: '000-00-0021' },
  { username: 'daniel.evans', password: 'EvansDan#2026', role: 'user', email: 'devans@mobilitypartners.com', ssn: '000-00-0022' },
  { username: 'hannah.baker', password: 'HannahB$33', role: 'user', email: 'hbaker@designstudio.net', ssn: '000-00-0023' },
  { username: 'samuel.green', password: 'GreenCap*44', role: 'user', email: 'sam.green@greencapital.com', ssn: '000-00-0024' },
  { username: 'zack.morris', password: 'ZackMorris!Bayside', role: 'user', email: 'zack.m@pacificventures.com', ssn: '000-00-0025' },
  { username: 'natalie.portman', password: 'NatalieP#Creative', role: 'user', email: 'natalie.p@hollywoodcreative.com', ssn: '000-00-0026' },
  { username: 'rohit.malhotra', password: 'RohitM@Delhi', role: 'user', email: 'rohit.malhotra@delhitech.in', ssn: '000-00-0027' },
  { username: 'kavya.nair', password: 'KavyaN#Kochi', role: 'user', email: 'kavya.nair@keralabio.org', ssn: '000-00-0028' },
  { username: 'sanjay.singh', password: 'SanjayS$Pune', role: 'user', email: 'sanjay.singh@puneglobal.com', ssn: '000-00-0029' },
  { username: 'meera.joshi', password: 'MeeraJ!Ahmedabad', role: 'user', email: 'meera.joshi@ahmedabadtextiles.com', ssn: '000-00-0030' },
];
const vehicles = [
  { id: '1', image: '/vehicles/1.jpg', images: ['/vehicles/1-0.jpg', '/vehicles/1-1.jpg', '/vehicles/1-2.jpg'], make: 'Toyota', model: 'Corolla', year: 2018, price: 12000, isPrivate: false, dealerCost: 8000, sellerSSN: '111-11-1111', sellerEmail: 'dealer1@lab.local', mileage: 45000, fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'White', vin: 'JTDBL40E897123456', location: 'Mumbai', features: ['ABS', 'Airbags', 'Touchscreen', 'Rear Camera', 'Cruise Control'], reviews: [{ user: 'Rahul S.', rating: 5, text: 'Smooth drive, great mileage. Very happy with the purchase.' }, { user: 'Priya M.', rating: 4, text: 'Comfortable sedan, service network is excellent.' }] },
  { id: '2', image: '/vehicles/2.jpg', images: ['/vehicles/2-0.jpg', '/vehicles/2-1.jpg', '/vehicles/2-2.jpg'], make: 'Honda', model: 'Civic', year: 2020, price: 16000, isPrivate: false, dealerCost: 11000, sellerSSN: '222-22-2222', sellerEmail: 'dealer2@lab.local', mileage: 32000, fuel: 'Petrol', transmission: 'CVT', body: 'Sedan', color: 'Silver', vin: '2HGFC2F59LH543210', location: 'Delhi', features: ['Sunroof', 'Lane Watch', 'Apple CarPlay', 'LED DRLs', '6 Airbags'], reviews: [{ user: 'Amit K.', rating: 5, text: 'Premium feel, refined engine, worth every rupee.' }] },
  { id: '3', image: '/vehicles/3.jpg', images: ['/vehicles/3-0.jpg', '/vehicles/3-1.jpg', '/vehicles/3-2.jpg'], make: 'Ford', model: 'Mustang', year: 1967, price: 45000, isPrivate: true, dealerCost: 30000, sellerSSN: '333-33-3333', sellerEmail: 'private@lab.local', mileage: 18000, fuel: 'Petrol', transmission: 'Manual', body: 'Coupe', color: 'Red', vin: '7R01C123456', location: 'Chennai', features: ['V8 Engine', 'Leather Seats', 'Classic Chrome', 'Rally Pack'], reviews: [{ user: 'Vikram R.', rating: 5, text: 'A dream car. Turns heads everywhere.' }] },
  { id: '4', image: '/vehicles/4.jpg', images: ['/vehicles/4-0.jpg', '/vehicles/4-1.jpg', '/vehicles/4-2.jpg'], make: 'Tesla', model: 'Model 3', year: 2022, price: 35000, isPrivate: true, dealerCost: 28000, sellerSSN: '444-44-4444', sellerEmail: 'vip@lab.local', mileage: 12000, fuel: 'Electric', transmission: 'Automatic', body: 'Sedan', color: 'Blue', vin: '5YJ3E1EB7NF123456', location: 'Bangalore', features: ['Autopilot', 'Glass Roof', '15" Touchscreen', 'OTA Updates', 'Supercharging'], reviews: [{ user: 'Sneha P.', rating: 5, text: 'Instant torque, zero fuel bills. The future is here.' }] },
  { id: '5', image: '/vehicles/5.jpg', images: ['/vehicles/5-0.jpg', '/vehicles/5-1.jpg', '/vehicles/5-2.jpg'], make: 'Hyundai', model: 'Creta', year: 2021, price: 14500, isPrivate: false, dealerCost: 10500, sellerSSN: '555-55-5555', sellerEmail: 'dealer3@lab.local', mileage: 28000, fuel: 'Diesel', transmission: 'Automatic', body: 'SUV', color: 'White', vin: 'KMHJB81DBMU123456', location: 'Pune', features: ['Panoramic Sunroof', 'Ventilated Seats', 'Bose Audio', '360 Camera', 'ADAS'], reviews: [{ user: 'Rohit D.', rating: 4, text: 'Feature loaded SUV, great for family trips.' }] },
  { id: '6', image: '/vehicles/6.jpg', images: ['/vehicles/6-0.jpg', '/vehicles/6-1.jpg', '/vehicles/6-2.jpg'], make: 'Maruti Suzuki', model: 'Swift', year: 2019, price: 6500, isPrivate: false, dealerCost: 4800, sellerSSN: '666-66-6666', sellerEmail: 'dealer4@lab.local', mileage: 38000, fuel: 'Petrol', transmission: 'Manual', body: 'Hatchback', color: 'Red', vin: 'MA3EJK1234S123456', location: 'Hyderabad', features: ['ABS', 'Touchscreen', 'Reverse Camera', 'Keyless Entry'], reviews: [{ user: 'Kavya L.', rating: 5, text: 'Peppy hatchback, super easy to maintain.' }] },
  { id: '7', image: '/vehicles/7.jpg', images: ['/vehicles/7-0.jpg', '/vehicles/7-1.jpg', '/vehicles/7-2.jpg'], make: 'Mahindra', model: 'Thar', year: 2022, price: 15500, isPrivate: false, dealerCost: 11500, sellerSSN: '777-77-7777', sellerEmail: 'dealer5@lab.local', mileage: 15000, fuel: 'Diesel', transmission: 'Manual', body: 'SUV', color: 'Black', vin: 'MZYBF1234RK123456', location: 'Jaipur', features: ['4x4', 'Convertible Top', 'Touchscreen', 'Off-road Tyres'], reviews: [{ user: 'Arjun V.', rating: 5, text: 'Proper off-roader, built like a tank.' }] },
  { id: '8', image: '/vehicles/8.jpg', images: ['/vehicles/8-0.jpg', '/vehicles/8-1.jpg', '/vehicles/8-2.jpg'], make: 'Tata', model: 'Nexon EV', year: 2023, price: 16500, isPrivate: false, dealerCost: 12000, sellerSSN: '888-88-8888', sellerEmail: 'dealer6@lab.local', mileage: 8000, fuel: 'Electric', transmission: 'Automatic', body: 'SUV', color: 'Teal', vin: 'MAT4567890EV123456', location: 'Kochi', features: ['Ziptron Tech', 'Connected Car', 'Sunroof', 'Harman Audio'], reviews: [{ user: 'Deepa N.', rating: 4, text: 'Great EV for city, charging at home is convenient.' }] },
  { id: '9', image: '/vehicles/9.jpg', images: ['/vehicles/9-0.jpg', '/vehicles/9-1.jpg', '/vehicles/9-2.jpg'], make: 'Kia', model: 'Seltos', year: 2021, price: 13500, isPrivate: false, dealerCost: 9800, sellerSSN: '999-99-9999', sellerEmail: 'dealer7@lab.local', mileage: 25000, fuel: 'Petrol', transmission: 'DCT', body: 'SUV', color: 'Grey', vin: 'KNA123456789012345', location: 'Ahmedabad', features: ['Sunroof', 'Ventilated Seats', 'Bose Sound', 'UVO Connect'], reviews: [{ user: 'Meera J.', rating: 4, text: 'Stylish and comfortable, good highway cruiser.' }] },
  { id: '10', image: '/vehicles/10.jpg', images: ['/vehicles/10-0.jpg', '/vehicles/10-1.jpg', '/vehicles/10-2.jpg'], make: 'Toyota', model: 'Fortuner', year: 2020, price: 32000, isPrivate: false, dealerCost: 24000, sellerSSN: '101-10-1010', sellerEmail: 'dealer8@lab.local', mileage: 40000, fuel: 'Diesel', transmission: 'Automatic', body: 'SUV', color: 'White', vin: 'MHFJK1234567890123', location: 'Mumbai', features: ['4WD', '7 Seats', 'JBL Audio', 'Cooled Seats', 'ADAS'], reviews: [{ user: 'Sanjay G.', rating: 5, text: 'Commanding road presence, bulletproof reliability.' }] },
  { id: '11', image: '/vehicles/11.jpg', images: ['/vehicles/11-0.jpg', '/vehicles/11-1.jpg', '/vehicles/11-2.jpg'], make: 'Honda', model: 'City', year: 2019, price: 9500, isPrivate: false, dealerCost: 7000, sellerSSN: '111-11-1112', sellerEmail: 'dealer9@lab.local', mileage: 42000, fuel: 'Petrol', transmission: 'CVT', body: 'Sedan', color: 'Grey', vin: '2HGFC1F59KH1234567', location: 'Delhi', features: ['Sunroof', 'Lane Watch', 'Cruise Control', 'Rear Camera'], reviews: [{ user: 'Nisha T.', rating: 4, text: 'Refined and frugal, perfect city sedan.' }] },
  { id: '12', image: '/vehicles/12.jpg', images: ['/vehicles/12-0.jpg', '/vehicles/12-1.jpg', '/vehicles/12-2.jpg'], make: 'Maruti Suzuki', model: 'Baleno', year: 2022, price: 7800, isPrivate: false, dealerCost: 5600, sellerSSN: '121-12-1212', sellerEmail: 'dealer10@lab.local', mileage: 22000, fuel: 'Petrol', transmission: 'AMT', body: 'Hatchback', color: 'Blue', vin: 'MA3EJK5678B1234567', location: 'Pune', features: ['Smartplay', 'HUD', '360 Camera', 'Arkamys Audio'], reviews: [{ user: 'Farhan A.', rating: 4, text: 'Premium hatchback feel at a budget price.' }] },
  { id: '13', image: '/vehicles/13.jpg', images: ['/vehicles/13-0.jpg', '/vehicles/13-1.jpg', '/vehicles/13-2.jpg'], make: 'Hyundai', model: 'Verna', year: 2021, price: 11500, isPrivate: false, dealerCost: 8500, sellerSSN: '131-13-1313', sellerEmail: 'dealer11@lab.local', mileage: 30000, fuel: 'Diesel', transmission: 'DCT', body: 'Sedan', color: 'Black', vin: 'KMH234567890123456', location: 'Chennai', features: ['Sunroof', 'Ventilated Seats', 'Bose Audio', 'Digital Key'], reviews: [{ user: 'Divya R.', rating: 4, text: 'Sporty looks, punchy diesel engine.' }] },
  { id: '14', image: '/vehicles/14.jpg', images: ['/vehicles/14-0.jpg', '/vehicles/14-1.jpg', '/vehicles/14-2.jpg'], make: 'Tata', model: 'Harrier', year: 2022, price: 19500, isPrivate: false, dealerCost: 14500, sellerSSN: '141-14-1414', sellerEmail: 'dealer12@lab.local', mileage: 20000, fuel: 'Diesel', transmission: 'Automatic', body: 'SUV', color: 'Orca Blue', vin: 'MAT8901234EV123456', location: 'Bangalore', features: ['Panoramic Sunroof', 'JBL Audio', 'ADAS', 'Terrain Modes'], reviews: [{ user: 'Karthik M.', rating: 5, text: 'Land Rover derived platform, superb build.' }] },
  { id: '15', image: '/vehicles/15.jpg', images: ['/vehicles/15-0.jpg', '/vehicles/15-1.jpg', '/vehicles/15-2.jpg'], make: 'MG', model: 'Hector', year: 2020, price: 15500, isPrivate: false, dealerCost: 11500, sellerSSN: '151-15-1515', sellerEmail: 'dealer13@lab.local', mileage: 35000, fuel: 'Hybrid', transmission: 'CVT', body: 'SUV', color: 'Starry Black', vin: 'MGH123456789012345', location: 'Hyderabad', features: ['10.4" Touchscreen', 'Panoramic Sunroof', 'Infinity Audio', 'Connected Car'], reviews: [{ user: 'Ananya S.', rating: 4, text: 'Tech loaded, spacious cabin.' }] },
  { id: '16', image: '/vehicles/16.jpg', images: ['/vehicles/16-0.jpg', '/vehicles/16-1.jpg', '/vehicles/16-2.jpg'], make: 'Skoda', model: 'Kushaq', year: 2022, price: 13500, isPrivate: false, dealerCost: 10000, sellerSSN: '161-16-1616', sellerEmail: 'dealer14@lab.local', mileage: 18000, fuel: 'Petrol', transmission: 'DSG', body: 'SUV', color: 'Candy White', vin: 'TMB123456789012345', location: 'Mumbai', features: ['Sunroof', 'Ventilated Seats', 'Wireless CarPlay', 'Cruise Control'], reviews: [{ user: 'Rahul V.', rating: 4, text: 'Solid European build, fun to drive.' }] },
  { id: '17', image: '/vehicles/17.jpg', images: ['/vehicles/17-0.jpg', '/vehicles/17-1.jpg', '/vehicles/17-2.jpg'], make: 'Volkswagen', model: 'Virtus', year: 2021, price: 11500, isPrivate: false, dealerCost: 8500, sellerSSN: '171-17-1717', sellerEmail: 'dealer15@lab.local', mileage: 28000, fuel: 'Petrol', transmission: 'DSG', body: 'Sedan', color: 'Wild Cherry Red', vin: 'VW1234567890123456', location: 'Delhi', features: ['Sunroof', 'Ventilated Seats', 'Digital Cockpit', '6 Airbags'], reviews: [{ user: 'Ishaan B.', rating: 4, text: 'German engineering, confident highway manners.' }] },
  { id: '18', image: '/vehicles/18.jpg', images: ['/vehicles/18-0.jpg', '/vehicles/18-1.jpg', '/vehicles/18-2.jpg'], make: 'Jeep', model: 'Compass', year: 2021, price: 18500, isPrivate: false, dealerCost: 13500, sellerSSN: '181-18-1818', sellerEmail: 'dealer16@lab.local', mileage: 30000, fuel: 'Diesel', transmission: 'Automatic', body: 'SUV', color: 'Minimal Grey', vin: 'MHW123456789012345', location: 'Jaipur', features: ['4x4', 'Panoramic Sunroof', 'Uconnect', 'Terrain Select'], reviews: [{ user: 'Aditya K.', rating: 4, text: 'Capable SUV with premium cabin.' }] },
  { id: '19', image: '/vehicles/19.jpg', images: ['/vehicles/19-0.jpg', '/vehicles/19-1.jpg', '/vehicles/19-2.jpg'], make: 'Nissan', model: 'Magnite', year: 2022, price: 7500, isPrivate: false, dealerCost: 5500, sellerSSN: '191-19-1919', sellerEmail: 'dealer17@lab.local', mileage: 15000, fuel: 'Petrol', transmission: 'CVT', body: 'SUV', color: 'White', vin: 'MDH123456789012345', location: 'Kochi', features: ['8" Touchscreen', '360 Camera', 'Wireless CarPlay', 'Arkamys Audio'], reviews: [{ user: 'Gokul R.', rating: 4, text: 'Value packed compact SUV.' }] },
  { id: '20', image: '/vehicles/20.jpg', images: ['/vehicles/20-0.jpg', '/vehicles/20-1.jpg', '/vehicles/20-2.jpg'], make: 'Renault', model: 'Kiger', year: 2021, price: 6800, isPrivate: false, dealerCost: 5000, sellerSSN: '201-20-2020', sellerEmail: 'dealer18@lab.local', mileage: 25000, fuel: 'Petrol', transmission: 'AMT', body: 'SUV', color: 'Cactus Green', vin: 'MH1234567890123456', location: 'Ahmedabad', features: ['8" Touchscreen', 'Wireless Android Auto', 'Rear AC Vents'], reviews: [{ user: 'Pooja D.', rating: 4, text: 'Practical and peppy, low running cost.' }] },
  { id: '21', image: '/vehicles/21.jpg', images: ['/vehicles/21-0.jpg', '/vehicles/21-1.jpg', '/vehicles/21-2.jpg'], make: 'BMW', model: '3 Series', year: 2020, price: 38000, isPrivate: false, dealerCost: 30000, sellerSSN: '211-21-2121', sellerEmail: 'dealer19@lab.local', mileage: 25000, fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'Alpine White', vin: 'WBA123456789012345', location: 'Mumbai', features: ['M Sport', 'Panoramic Sunroof', 'Harman Kardon', 'Gesture Control'], reviews: [{ user: 'Rohan M.', rating: 5, text: 'The ultimate driving machine, as advertised.' }] },
  { id: '22', image: '/vehicles/22.jpg', images: ['/vehicles/22-0.jpg', '/vehicles/22-1.jpg', '/vehicles/22-2.jpg'], make: 'Mercedes-Benz', model: 'C-Class', year: 2021, price: 42000, isPrivate: false, dealerCost: 33000, sellerSSN: '221-22-2122', sellerEmail: 'dealer20@lab.local', mileage: 20000, fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'Obsidian Black', vin: 'WDD123456789012345', location: 'Delhi', features: ['MBUX', 'Burmester Audio', 'Ambient Lighting', 'Air Suspension'], reviews: [{ user: 'Aisha K.', rating: 5, text: 'Luxury and comfort in every mile.' }] },
  { id: '23', image: '/vehicles/23.jpg', images: ['/vehicles/23-0.jpg', '/vehicles/23-1.jpg', '/vehicles/23-2.jpg'], make: 'Audi', model: 'A4', year: 2020, price: 36000, isPrivate: false, dealerCost: 28000, sellerSSN: '231-23-2123', sellerEmail: 'dealer21@lab.local', mileage: 28000, fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'Mythos Black', vin: 'WAU123456789012345', location: 'Bangalore', features: ['Virtual Cockpit', 'Matrix LED', 'B&O Audio', 'Quattro'], reviews: [{ user: 'Varun S.', rating: 5, text: 'Understated luxury with quattro grip.' }] },
  { id: '24', image: '/vehicles/24.jpg', images: ['/vehicles/24-0.jpg', '/vehicles/24-1.jpg', '/vehicles/24-2.jpg'], make: 'Toyota', model: 'Innova Crysta', year: 2019, price: 21000, isPrivate: false, dealerCost: 16000, sellerSSN: '241-24-2124', sellerEmail: 'dealer22@lab.local', mileage: 55000, fuel: 'Diesel', transmission: 'Automatic', body: 'MPV', color: 'Super White', vin: 'MHF1234567890123456', location: 'Chennai', features: ['7 Seats', 'Captain Seats', 'Rear Entertainment', 'Cruise Control'], reviews: [{ user: 'Lakshmi N.', rating: 5, text: 'The family workhorse, never lets you down.' }] },
  { id: '25', image: '/vehicles/25.jpg', images: ['/vehicles/25-0.jpg', '/vehicles/25-1.jpg', '/vehicles/25-2.jpg'], make: 'Mahindra', model: 'XUV700', year: 2023, price: 18500, isPrivate: false, dealerCost: 14000, sellerSSN: '251-25-2125', sellerEmail: 'dealer23@lab.local', mileage: 10000, fuel: 'Diesel', transmission: 'Automatic', body: 'SUV', color: 'Midnight Black', vin: 'MZY123456789012345', location: 'Pune', features: ['ADAS', 'Panoramic Skyroof', 'Sony 3D Audio', 'Flush Door Handles'], reviews: [{ user: 'Nikhil P.', rating: 5, text: 'Feature bomb, feels like a much pricier SUV.' }] },
  { id: '26', image: '/vehicles/26.jpg', images: ['/vehicles/26-0.jpg', '/vehicles/26-1.jpg', '/vehicles/26-2.jpg'], make: 'Tata', model: 'Altroz', year: 2020, price: 7200, isPrivate: false, dealerCost: 5300, sellerSSN: '261-26-2126', sellerEmail: 'dealer24@lab.local', mileage: 30000, fuel: 'Diesel', transmission: 'Manual', body: 'Hatchback', color: 'Highland Grey', vin: 'MAT1234567890123456', location: 'Hyderabad', features: ['5-Star Safety', '7" Touchscreen', 'Rear Camera', 'iRA Connected'], reviews: [{ user: 'Shreya T.', rating: 4, text: 'Safest hatchback in its class.' }] },
  { id: '27', image: '/vehicles/27.jpg', images: ['/vehicles/27-0.jpg', '/vehicles/27-1.jpg', '/vehicles/27-2.jpg'], make: 'Honda', model: 'Amaze', year: 2021, price: 7200, isPrivate: false, dealerCost: 5300, sellerSSN: '271-27-2127', sellerEmail: 'dealer25@lab.local', mileage: 28000, fuel: 'Petrol', transmission: 'CVT', body: 'Sedan', color: 'Radiant Red', vin: '2HGFC3F59MH1234567', location: 'Kochi', features: ['Sunroof', 'Digipad', 'Rear Camera', 'Cruise Control'], reviews: [{ user: 'Arnav J.', rating: 4, text: 'Big car feel in a compact footprint.' }] },
  { id: '28', image: '/vehicles/28.jpg', images: ['/vehicles/28-0.jpg', '/vehicles/28-1.jpg', '/vehicles/28-2.jpg'], make: 'Hyundai', model: 'i20', year: 2022, price: 8500, isPrivate: false, dealerCost: 6300, sellerSSN: '281-28-2128', sellerEmail: 'dealer26@lab.local', mileage: 20000, fuel: 'Petrol', transmission: 'IVT', body: 'Hatchback', color: 'Polar White', vin: 'KMH1234567890123456', location: 'Jaipur', features: ['Sunroof', 'Bose Audio', 'BlueLink', 'Wireless Charger'], reviews: [{ user: 'Tanvi M.', rating: 4, text: 'Premium hatchback with great features.' }] },
  { id: '29', image: '/vehicles/29.jpg', images: ['/vehicles/29-0.jpg', '/vehicles/29-1.jpg', '/vehicles/29-2.jpg'], make: 'Kia', model: 'Sonet', year: 2022, price: 9500, isPrivate: false, dealerCost: 7000, sellerSSN: '291-29-2129', sellerEmail: 'dealer27@lab.local', mileage: 18000, fuel: 'Petrol', transmission: 'DCT', body: 'SUV', color: 'Gravity Grey', vin: 'KNA1234567890123456', location: 'Ahmedabad', features: ['Sunroof', 'Ventilated Seats', 'Bose Audio', 'UVO Connect'], reviews: [{ user: 'Dev P.', rating: 4, text: 'Compact SUV with a long feature list.' }] },
  { id: '30', image: '/vehicles/30.jpg', images: ['/vehicles/30-0.jpg', '/vehicles/30-1.jpg', '/vehicles/30-2.jpg'], make: 'Maruti Suzuki', model: 'Dzire', year: 2021, price: 7800, isPrivate: false, dealerCost: 5700, sellerSSN: '301-30-2130', sellerEmail: 'dealer28@lab.local', mileage: 35000, fuel: 'Petrol', transmission: 'AMT', body: 'Sedan', color: 'Pearl Arctic White', vin: 'MA3EJK9012C1234567', location: 'Delhi', features: ['Smartplay', 'Auto LED Headlamps', 'Rear Camera', 'Cruise Control'], reviews: [{ user: 'Ritika S.', rating: 4, text: 'India favourite sedan for good reason.' }] },
  { id: '31', image: '/vehicles/3.jpg', images: ['/vehicles/3-0.jpg', '/vehicles/3-1.jpg', '/vehicles/3-2.jpg'], make: 'Porsche', model: '911 Carrera S', year: 2023, price: 124000, isPrivate: false, dealerCost: 98000, sellerSSN: '311-31-3131', sellerEmail: 'marcus.vance@autohub.in', mileage: 12500, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'GT Silver', vin: 'WP0AB2A99PS123456', location: 'Mumbai', features: ['Sport Chrono Package', 'PASM Sport Suspension', 'Burmester High-End Surround', 'Full Front PPF', 'Sport Exhaust'], reviews: [{ user: 'Vikram Mehta', rating: 5, text: 'The benchmark sports car. The twin-turbo flat-six sounds glorious and the PDK gearbox is instant.' }, { user: 'Dr. Sameer Roy', rating: 5, text: 'Daily drivable supercar performance with unbelievable road composure.' }] },
  { id: '32', image: '/vehicles/21.jpg', images: ['/vehicles/21-0.jpg', '/vehicles/21-1.jpg', '/vehicles/21-2.jpg'], make: 'BMW', model: 'M4 Competition', year: 2022, price: 78500, isPrivate: false, dealerCost: 61000, sellerSSN: '321-32-3132', sellerEmail: 'elena.rostova@primemotors.in', mileage: 18200, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Isle of Man Green', vin: 'WBS33AZ09NC123456', location: 'Delhi', features: ['M Carbon Exterior Package', 'M Carbon Bucket Seats', 'Laserlight Headlamps', 'Head-Up Display', 'Harman Kardon'], reviews: [{ user: 'Kabir Singhania', rating: 5, text: 'The S58 engine pulls like a freight train. Exceptional chassis dynamics on track and road.' }] },
  { id: '33', image: '/vehicles/22.jpg', images: ['/vehicles/22-0.jpg', '/vehicles/22-1.jpg', '/vehicles/22-2.jpg'], make: 'Mercedes-Benz', model: 'AMG C63 S', year: 2021, price: 69000, isPrivate: false, dealerCost: 54000, sellerSSN: '331-33-3133', sellerEmail: 'david.kim@citydrive.in', mileage: 24000, fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'Obsidian Black', vin: 'WDD2050871F123456', location: 'Bengaluru', features: ['4.0L BiTurbo V8', 'AMG Performance Exhaust', 'Burmester 3D Sound', 'Panoramic Sunroof', 'AMG Track Pace'], reviews: [{ user: 'Rohan Deshmukh', rating: 5, text: 'The last pure V8 C63. The exhaust rumble is unmatched and the cabin is top-tier luxury.' }] },
  { id: '34', image: '/vehicles/4.jpg', images: ['/vehicles/4-0.jpg', '/vehicles/4-1.jpg', '/vehicles/4-2.jpg'], make: 'Tesla', model: 'Model S Plaid', year: 2023, price: 86000, isPrivate: false, dealerCost: 69000, sellerSSN: '341-34-3134', sellerEmail: 'sarah.jenkins@sunrisecars.in', mileage: 14100, fuel: 'Electric', transmission: 'Automatic', body: 'Sedan', color: 'Deep Blue Metallic', vin: '5YJSA1E67PF123456', location: 'Pune', features: ['Tri-Motor AWD 1020 HP', 'Full Self-Driving Capability', '21" Arachnid Wheels', 'Yoke Steering', 'Gaming Computer'], reviews: [{ user: 'Aditi Rao', rating: 5, text: '0-60 in under 2 seconds bends the laws of physics. Impeccable technology and zero emissions.' }] },
  { id: '35', image: '/vehicles/23.jpg', images: ['/vehicles/23-0.jpg', '/vehicles/23-1.jpg', '/vehicles/23-2.jpg'], make: 'Audi', model: 'RS5 Sportback', year: 2022, price: 72500, isPrivate: false, dealerCost: 57000, sellerSSN: '351-35-3135', sellerEmail: 'raj.patel@galaxyauto.in', mileage: 19800, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Nardo Grey', vin: 'WAUZZZF53NA123456', location: 'Chennai', features: ['2.9L Twin-Turbo V6', 'Quattro with Sport Diff', 'Bang & Olufsen 3D', 'RS Sport Exhaust', 'Carbon Inlays'], reviews: [{ user: 'Gautam Menon', rating: 5, text: 'Stunning proportions with all-weather Quattro confidence. Fast, practical, and gorgeous.' }] },
  { id: '36', image: '/vehicles/14.jpg', images: ['/vehicles/14-0.jpg', '/vehicles/14-1.jpg', '/vehicles/14-2.jpg'], make: 'Land Rover', model: 'Range Rover Sport', year: 2023, price: 92000, isPrivate: false, dealerCost: 74000, sellerSSN: '361-36-3136', sellerEmail: 'marcus.vance@autohub.in', mileage: 16000, fuel: 'Hybrid', transmission: 'Automatic', body: 'SUV', color: 'Santorini Black', vin: 'SALWR2V47PA123456', location: 'Mumbai', features: ['Dynamic Air Suspension', 'Meridian Signature Sound', 'Pivi Pro Curved Screen', 'Soft-Close Doors', 'All-Wheel Steering'], reviews: [{ user: 'Tarun Khurana', rating: 5, text: 'Ultimate luxury cruiser. Air suspension floats over bad roads effortlessly.' }] },
  { id: '37', image: '/vehicles/2.jpg', images: ['/vehicles/2-0.jpg', '/vehicles/2-1.jpg', '/vehicles/2-2.jpg'], make: 'Lexus', model: 'LC 500', year: 2022, price: 82000, isPrivate: false, dealerCost: 65000, sellerSSN: '371-37-3137', sellerEmail: 'elena.rostova@primemotors.in', mileage: 15400, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Infrared Red', vin: 'JTHHP5AY4NA123456', location: 'Delhi', features: ['5.0L Naturally Aspirated V8', 'Mark Levinson Reference Audio', 'Alcantara Headliner', 'Active Rear Spoiler', 'Head-Up Display'], reviews: [{ user: 'Naveen Jindal', rating: 5, text: 'Concept car styling that made it to production. The atmospheric V8 exhaust tone is pure music.' }] },
  { id: '38', image: '/vehicles/10.jpg', images: ['/vehicles/10-0.jpg', '/vehicles/10-1.jpg', '/vehicles/10-2.jpg'], make: 'Volvo', model: 'XC90 Recharge', year: 2023, price: 68000, isPrivate: false, dealerCost: 53000, sellerSSN: '381-38-3138', sellerEmail: 'david.kim@citydrive.in', mileage: 17500, fuel: 'Plug-in Hybrid', transmission: 'Automatic', body: 'SUV', color: 'Crystal White', vin: 'YV4BR0CU7P1123456', location: 'Bengaluru', features: ['Bowers & Wilkins High Fidelity', 'Air Purifier PM2.5', '7-Seat Luxury Config', 'Pilot Assist ADAS', 'Orrefors Crystal Shifter'], reviews: [{ user: 'Shalini Pillai', rating: 5, text: 'The safest luxury family SUV. Bowers & Wilkins audio is the best sound system in any automobile.' }] },
  { id: '39', image: '/vehicles/7.jpg', images: ['/vehicles/7-0.jpg', '/vehicles/7-1.jpg', '/vehicles/7-2.jpg'], make: 'Ford', model: 'Bronco Wildtrak', year: 2022, price: 54000, isPrivate: false, dealerCost: 43000, sellerSSN: '391-39-3139', sellerEmail: 'sarah.jenkins@sunrisecars.in', mileage: 21000, fuel: 'Petrol', transmission: 'Automatic', body: 'SUV', color: 'Cyber Orange', vin: '1FMEE5DP6NL123456', location: 'Pune', features: ['Sasquatch Package', 'Bilstein Position-Sensitive Dampers', '35" Mud-Terrain Tires', 'Removable Doors & Roof', 'B&O Audio'], reviews: [{ user: 'Manish Bakshi', rating: 5, text: 'Unstoppable off-road capability with massive street presence. Taking the doors off is pure joy.' }] },
  { id: '40', image: '/vehicles/3.jpg', images: ['/vehicles/3-0.jpg', '/vehicles/3-1.jpg', '/vehicles/3-2.jpg'], make: 'Chevrolet', model: 'Corvette Stingray', year: 2023, price: 79500, isPrivate: false, dealerCost: 63000, sellerSSN: '401-40-3140', sellerEmail: 'raj.patel@galaxyauto.in', mileage: 11200, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Torch Red', vin: '1G1YB2D47P5123456', location: 'Hyderabad', features: ['Z51 Performance Package', 'Front Axle Lift with Memory', 'Bose Performance 14-Speaker', 'GT2 Bucket Seats', 'Magnetic Ride Control'], reviews: [{ user: 'Siddharth Varma', rating: 5, text: 'Mid-engine exotic feel at an attainable price. Blistering acceleration and razor-sharp steering.' }] },
  { id: '41', image: '/vehicles/17.jpg', images: ['/vehicles/17-0.jpg', '/vehicles/17-1.jpg', '/vehicles/17-2.jpg'], make: 'Jaguar', model: 'F-Type R', year: 2021, price: 74000, isPrivate: false, dealerCost: 58000, sellerSSN: '411-41-3141', sellerEmail: 'marcus.vance@autohub.in', mileage: 18900, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'British Racing Green', vin: 'SAJDF1EV8MC123456', location: 'Mumbai', features: ['5.0L Supercharged V8 575HP', 'Switchable Active Exhaust', 'Meridian Surround Audio', 'Carbon Ceramic Brakes', 'Windsor Leather Performance Seats'], reviews: [{ user: 'Harshwardhan Patil', rating: 5, text: 'Vicious supercharged acceleration and arguably the most beautiful silhouette of the 21st century.' }] },
  { id: '42', image: '/vehicles/18.jpg', images: ['/vehicles/18-0.jpg', '/vehicles/18-1.jpg', '/vehicles/18-2.jpg'], make: 'Land Rover', model: 'Defender 110 X', year: 2023, price: 88500, isPrivate: false, dealerCost: 71000, sellerSSN: '421-42-3142', sellerEmail: 'elena.rostova@primemotors.in', mileage: 14500, fuel: 'Petrol', transmission: 'Automatic', body: 'SUV', color: 'Gondwana Stone', vin: 'SALER2V46PA123456', location: 'Delhi', features: ['Electronic Air Suspension', 'Configurable Terrain Response 2', 'ClearSight Ground View Camera', 'Heated & Cooled Seats', 'Black Exterior Pack'], reviews: [{ user: 'Col. Vijay Rathore', rating: 5, text: 'The ultimate go-anywhere luxury expedition overland vehicle. Incredibly refined on long highway runs.' }] },
  { id: '43', image: '/vehicles/21.jpg', images: ['/vehicles/21-0.jpg', '/vehicles/21-1.jpg', '/vehicles/21-2.jpg'], make: 'Aston Martin', model: 'Vantage V8', year: 2021, price: 118000, isPrivate: false, dealerCost: 95000, sellerSSN: '431-43-3143', sellerEmail: 'david.kim@citydrive.in', mileage: 13200, fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Onyx Black', vin: 'SCFRMFBD7MC123456', location: 'Bengaluru', features: ['4.0L Twin-Turbo V8', 'Sport Plus Seats & Steering', 'Aston Martin Premium Audio', 'Quad Matte Black Exhausts', 'Forged 20" Wheels'], reviews: [{ user: 'Zafar Iqbal', rating: 5, text: 'Pure James Bond elegance with predatory pace. The craftsmanship of the interior leather is peerless.' }] },
  { id: '44', image: '/vehicles/22.jpg', images: ['/vehicles/22-0.jpg', '/vehicles/22-1.jpg', '/vehicles/22-2.jpg'], make: 'Genesis', model: 'G90 Ultimate', year: 2023, price: 76000, isPrivate: false, dealerCost: 60000, sellerSSN: '441-44-3144', sellerEmail: 'sarah.jenkins@sunrisecars.in', mileage: 15100, fuel: 'Hybrid', transmission: 'Automatic', body: 'Sedan', color: 'Makalu Grey', vin: 'KMHKN4DM8PA123456', location: 'Ahmedabad', features: ['3.5L Twin-Turbo 48V e-S/C', 'Bang & Olufsen Premier 3D', 'Rear VIP Reclining Captain Seats', 'Power Easy-Close Doors', 'Multi-Chamber Air Suspension'], reviews: [{ user: 'Pramod Shah', rating: 5, text: 'Chauffeur perfection. Surpasses traditional flagship sedans in cabin quietness and materials.' }] },
  { id: '45', image: '/vehicles/1.jpg', images: ['/vehicles/1-0.jpg', '/vehicles/1-1.jpg', '/vehicles/1-2.jpg'], make: 'Maserati', model: 'Ghibli Trofeo', year: 2022, price: 81000, isPrivate: false, dealerCost: 64000, sellerSSN: '451-45-3145', sellerEmail: 'raj.patel@galaxyauto.in', mileage: 17800, fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'Blu Emozione', vin: 'ZAM57XTB5NA123456', location: 'Chandigarh', features: ['Ferrari-Built 3.8L Twin-Turbo V8 580HP', 'Pieno Fiore Natural Leather', 'Bowers & Wilkins Audio', 'Corsa Driving Mode', 'Carbon Fiber Aero'], reviews: [{ user: 'Simranjeet Gill', rating: 5, text: 'Ferrari V8 engine under the hood of an Italian luxury sedan. Exhilarating power and Italian flair.' }] },
];
const PRISTINE_VEHICLES = JSON.parse(JSON.stringify(vehicles));
const DEALERS = [
  { id: 'd1', name: 'AutoHub Mumbai', location: 'Andheri West, Mumbai', phone: '+91 98200 11111', email: 'sales@autohub.in', rating: 4.6, cars: 42 },
  { id: 'd2', name: 'Prime Motors Delhi', location: 'Okhla, New Delhi', phone: '+91 98110 22222', email: 'sales@primemotors.in', rating: 4.4, cars: 35 },
  { id: 'd3', name: 'CityDrive Bengaluru', location: 'Koramangala, Bengaluru', phone: '+91 99010 33333', email: 'sales@citydrive.in', rating: 4.7, cars: 51 },
  { id: 'd4', name: 'Sunrise Cars Pune', location: 'Baner, Pune', phone: '+91 98900 44444', email: 'sales@sunrisecars.in', rating: 4.3, cars: 28 },
  { id: 'd5', name: 'Galaxy Auto Chennai', location: 'OMR, Chennai', phone: '+91 98400 55555', email: 'sales@galaxyauto.in', rating: 4.5, cars: 38 },
  { id: 'd6', name: 'Apex Luxury Motors Hyderabad', location: 'Jubilee Hills, Hyderabad', phone: '+91 98480 66666', email: 'sales@apexluxury.in', rating: 4.9, cars: 64 },
  { id: 'd7', name: 'Deccan Certified Pre-Owned Ahmedabad', location: 'SG Highway, Ahmedabad', phone: '+91 98250 77777', email: 'sales@deccancertified.com', rating: 4.8, cars: 45 },
  { id: 'd8', name: 'Heritage Classics Jaipur', location: 'C-Scheme, Jaipur', phone: '+91 98290 88888', email: 'sales@heritageclassics.in', rating: 4.7, cars: 31 },
  { id: 'd9', name: 'Malabar Motors Kochi', location: 'Edappally, Kochi', phone: '+91 98470 99999', email: 'sales@malabarmotors.in', rating: 4.6, cars: 29 },
  { id: 'd10', name: 'Royal Auto Chandigarh', location: 'Sector 17, Chandigarh', phone: '+91 98140 10101', email: 'sales@royalautochd.in', rating: 4.8, cars: 40 },
];
const NEWS = [
  { id: 'n1', title: 'Tata Nexon EV Max launched with 453 km range', date: '2026-10-12', tag: 'Launches', body: 'Tata Motors has launched the Nexon EV Max with a larger 40.5 kWh battery pack, ARAI-certified 453 km range, and ventilated front seats. Prices start at ₹16.49 lakh ex-showroom.' },
  { id: 'n2', title: 'Maruti Suzuki Fronx crosses 1.5 lakh bookings', date: '2026-10-10', tag: 'Sales', body: 'Maruti Suzuki announced the compact SUV has crossed 1.5 lakh bookings since launch, with the turbo-petrol variant accounting for over 40% of demand.' },
  { id: 'n3', title: 'Hyundai Creta facelift teased with ADAS', date: '2026-10-08', tag: 'Spy Shots', body: 'Hyundai has teased the Creta facelift with Level 2 ADAS, a new parametric grille, and a redesigned cabin. Launch expected early next year.' },
  { id: 'n4', title: 'Used car prices rise 8% in Q3: report', date: '2026-10-05', tag: 'Industry', body: 'A new industry report shows used car prices rose 8% year-on-year in Q3, driven by strong demand for SUVs and EVs. Three-year-old models retained the best resale value.' },
  { id: 'n5', title: 'Kia Seltos X-Line edition announced', date: '2026-10-02', tag: 'Launches', body: 'Kia India has announced the Seltos X-Line edition with matte grey paint, blacked-out elements, and exclusive interior themes. Limited to 2,000 units.' },
  { id: 'n6', title: 'EMI rates: banks cut auto loan rates by 25 bps', date: '2026-09-28', tag: 'Finance', body: 'Several public sector banks have cut new car loan rates by 25 basis points, bringing the best offers to 8.4% for 7-year tenures. Experts say this could boost year-end sales.' },
  { id: 'n7', title: 'Luxury Pre-Owned Market Outpaces New Vehicle Registrations', date: '2026-09-24', tag: 'Market Trends', body: 'High demand for 2-to-3-year-old luxury marques including Porsche, BMW M, and Mercedes-AMG has propelled certified pre-owned transaction volumes by 28% quarter-over-quarter.' },
  { id: 'n8', title: 'UVP Capital Announces Zero-Down Prime Financing at 5.4% APR', date: '2026-09-20', tag: 'Finance', body: 'UVP Capital Direct has unlocked competitive fixed 5.4% APR financing for super-prime tier buyers with zero origination fees and instant 60-second digital approvals.' },
  { id: 'n9', title: 'Porsche 911 GT3 Retains Record 96% Residual Value', date: '2026-09-15', tag: 'Valuation', body: 'Independent algorithmic valuation indices confirm the 992-generation Porsche 911 GT3 holds the highest resale retention of any modern sports car, with pristine units appreciating over MSRP.' },
  { id: 'n10', title: 'Nationwide 350kW Ultra-Fast EV Charging Corridor Opens', date: '2026-09-11', tag: 'EV Infrastructure', body: 'A consortium of EV manufacturers and charging operators has commissioned 120 new 350kW liquid-cooled charging hubs along major national expressways.' },
  { id: 'n11', title: 'B2B Wholesale Auction Volume Hits Record $4.8M Weekly Run Rate', date: '2026-09-06', tag: 'Industry', body: 'AutoMarket B2B Wholesale Clearinghouse recorded its highest trade settlement volume to date, driven by institutional fleet consignment exchanges across tier-1 dealerships.' },
  { id: 'n12', title: 'Direct Doorstep Concierge Handover Now Available in 18 Metro Zones', date: '2026-08-30', tag: 'Services', body: 'VIP white-glove doorstep test drives and home deliveries now cover 18 metropolitan cities, complete with digital escrow signing and mobile mechanical inspection verification.' }
];
const privatePosts = [
  { id: 'p1', title: 'Dealer memo Q3', body: 'Margin targets + VIN list', author: 'administrator' },
  { id: 'p2', title: 'Repo list', body: 'Confidential repos', author: 'administrator' },
  { id: 'p3', title: 'Wholesale Tier-1 Escrow Protocol', body: 'All B2B settlement wires must clear through clearinghouse vault within 4 business hours.', author: 'administrator' },
  { id: 'p4', title: 'Q4 Luxury Marque Allocation Forecast', body: 'Porsche 992 GT3 and BMW M4 allocations will increase by 15% for certified platinum dealer franchises.', author: 'jordan.hayes' },
  { id: 'p5', title: 'Compliance Audit Checklist (2026)', body: 'Mandatory 200-point optical laser diagnostics required on all imported consignment stock.', author: 'claire.redfield' }
];

// balances / coupons / listings for race + business logic
let BALANCES = { wiener: 20000, carlos: 20000 };
let coupons = { WELCOME10: { uses: 0, max: 5, discount: 10 } };
let listings = [];
let checkoutState = {}; // user -> step

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- Mongo (optional; labs work on memory fallback) ----------
let mongoDb = null;
async function initMongo() {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    mongoDb = client.db('catalog');
    const c = mongoDb.collection('vehicles');
    if ((await c.countDocuments()) === 0) await c.insertMany(vehicles);
    console.log('mongo connected');
  } catch (e) {
    console.log('mongo unavailable, using memory fallback:', e.message);
  }
}
initMongo();

// ---------- NoSQL helpers ----------
// VULN: directly evaluates operators, incl. $where JS + $regex + $ne bypass
function matchesNoSQL(doc, query) {
  if (!query || typeof query !== 'object') return true;
  // $or / $and
  if (query.$or && Array.isArray(query.$or)) return query.$or.some(q => matchesNoSQL(doc, q));
  if (query.$and && Array.isArray(query.$and)) return query.$and.every(q => matchesNoSQL(doc, q));
  // $where -> server-side JS execution (vuln)
  if (query.$where && typeof query.$where === 'string') {
    try {
      const fn = new Function('obj', `with(obj){ return (${query.$where}); }`);
      if (fn(doc)) return true;
      // fallthrough to other keys
    } catch (e) { /* leak error for detection */ throw new Error('where-error:' + e.message); }
  }
  for (const k of Object.keys(query)) {
    if (k.startsWith('$')) continue;
    const qv = query[k];
    const dv = doc[k];
    if (qv !== null && typeof qv === 'object' && !Array.isArray(qv)) {
      for (const op of Object.keys(qv)) {
        let v = qv[op];
        // qs gives strings; try to keep string compare but allow bypass semantics
        if (op === '$ne') { if (String(dv) === String(v)) return false; }
        else if (op === '$gt') { if (!(Number(dv) > Number(v))) {
          // string fallback: lexicographic (allows ' ' bypass with $gt:'')
          if (!(String(dv) > String(v))) return false; } }
        else if (op === '$gte') { if (!(Number(dv) >= Number(v)) && !(String(dv) >= String(v))) return false; }
        else if (op === '$lt') { if (!(Number(dv) < Number(v))) return false; }
        else if (op === '$lte') { if (!(Number(dv) <= Number(v))) return false; }
        else if (op === '$regex') {
          try { if (!new RegExp(v).test(String(dv))) return false; }
          catch (e) { throw new Error('regex-error:' + e.message); }
        }
        else if (op === '$exists') {
          const exists = dv !== undefined;
          const want = (v === true || v === 'true' || v === 1 || v === '1');
          if (exists !== want) return false;
        }
        else if (op === '$in') {
          const arr = Array.isArray(v) ? v : [v];
          if (!arr.map(String).includes(String(dv))) return false;
        }
        else if (op === '$where') {
          const fn = new Function('obj', `with(obj){ return (${v}); }`);
          if (!fn(doc)) return false;
        }
        // unknown ops ignored (allows probing unknown fields via $exists)
      }
    } else {
      if (String(dv) !== String(qv)) return false;
    }
  }
  return true;
}
function findUsers(query) { return users.filter(u => { try { return matchesNoSQL(u, query); } catch (e) { throw e; } }); }
function findVehicles(query) {
  // merge query-string style {price:{gt:...}}? qs extended already gives {$gt}
  return vehicles.filter(v => { try { return matchesNoSQL(v, query); } catch (e) { throw e; } });
}

// ---------- basic ----------
app.get('/health', (req, res) => res.json({ ok: true, service: 'catalog-lab' }));
app.get('/version', (req, res) => res.json({ version: 'catalog-0.2.0-lab', mongo: !!mongoDb }));

// ---------- NoSQLi ----------
// Detect: /auth/detect?username[$ne]=x reflects behaviour
app.get('/auth/detect', (req, res) => {
  const q = req.query;
  try {
    const hit = findUsers(q);
    res.json({ query: q, count: hit.length, users: hit.map(u => u.username) });
  } catch (e) { res.status(500).json({ error: String(e.message), query: q }); }
});

// VULN: operator injection to bypass auth / extract data / unknown fields
// (naive WAF blocks the obvious comparison operators; the matcher still honors the rest)
const BLOCKED_OPS = /"\$(ne|gt|lt|gte|lte|where)"|'\$(ne|gt|lt|gte|lte|where)'/;
app.post('/auth/login', (req, res) => {
  if (BLOCKED_OPS.test(JSON.stringify(req.body || {}))) {
    return res.status(403).json({ error: 'operator not allowed' });
  }
  const { username, password } = req.body || {};
  // VULN: passes objects straight to matcher (no type check)
  const q = {};
  if (username !== undefined) q.username = username;
  if (password !== undefined) q.password = password;
  // also merge raw body extras (allows {"$where": "..."} )
  for (const k of Object.keys(req.body || {})) if (k.startsWith('$')) q[k] = req.body[k];
  try {
    const hit = findUsers(q);
    if (hit.length > 0) {
      const u = hit[0];
      return res.json({ ok: true, user: u.username, role: u.role, flag: u.username === 'administrator' ? 'LAB{nosql_auth_bypass}' : undefined });
    }
    res.status(401).json({ error: 'invalid credentials' });
  } catch (e) { res.status(500).json({ error: String(e.message), query: q }); } // error disclosure
});

// VULN: search with operators -> extract data + unknown fields via $exists/$regex
app.get('/vehicles/search', (req, res) => {
  const q = { ...req.query };
  delete q.debug;
  try {
    const hit = findVehicles(q);
    res.json({ query: q, count: hit.length, results: hit });
  } catch (e) { res.status(500).json({ error: String(e.message), query: q }); }
});
app.post('/vehicles/search', (req, res) => {
  const q = req.body || {};
  try {
    const hit = findVehicles(q);
    res.json({ query: q, count: hit.length, results: hit });
  } catch (e) { res.status(500).json({ error: String(e.message) }); }
});
// extract unknown fields helper: /vehicles/fields?field=dealerCost[$exists]=true style
app.get('/vehicles/fields', (req, res) => {
  // ?probe=dealerCost -> returns which docs have that field (unknown-field extraction)
  const probe = req.query.probe || req.query.field;
  if (!probe) return res.json({ error: 'missing probe parameter' });
  const hit = vehicles.filter(v => v[probe] !== undefined);
  res.json({ field: probe, exists_in: hit.length, sample: hit[0] ? { id: hit[0].id, [probe]: hit[0][probe] } : null });
});

// ---------- GraphQL ----------
// VULN: private fields exposed, privatePosts no authz, introspection on, CSRF via GET, no brute-force limit
const schema = buildSchema(`
  type Vehicle { id: ID, make: String, model: String, year: Int, price: Float, isPrivate: Boolean, dealerCost: Float, sellerSSN: String, sellerEmail: String }
  type Post { id: ID, title: String, body: String, author: String }
  type Query {
    vehicles: [Vehicle]
    vehicle(id: ID!): Vehicle
    privatePosts: [Post]
    hiddenDealerStats: String
  }
  type Mutation {
    login(username: String!, password: String!): String
    createListing(make: String!, model: String!, price: Float!): Vehicle
    updatePrice(id: ID!, price: Float!): Vehicle
  }
`);
let gqlLoginAttempts = 0;
// Dealer-only fields are withheld unless the request carries dealer context.
// The check only verifies the header is present, not its value.
const dealerCtx = (req) => ((req && req.headers) || {})['x-dealer-token'];
const dealerOnly = (req, obj) => {
  if (dealerCtx(req)) return obj;
  const { dealerCost, sellerSSN, sellerEmail, ...pub } = obj;
  return pub;
};
const root = {
  vehicles: (args, req) => vehicles.map(v => dealerOnly(req, v)),
  vehicle: ({ id }, req) => {
    const v = vehicles.find(v => v.id === String(id));
    return v ? dealerOnly(req, v) : v;
  },
  privatePosts: () => privatePosts, // VULN: no auth check
  hiddenDealerStats: () => 'LAB{graphql_private_field} margins=' + vehicles.map(v => `${v.id}:${v.dealerCost}`).join(','),
  login: ({ username, password }) => {
    gqlLoginAttempts++;
    // VULN: no rate limit -> brute force; verbose enum
    const u = users.find(x => x.username === username);
    if (!u) throw new Error('user not found (enumeration)');
    if (u.password !== password) throw new Error('wrong password');
    return `token-${u.username}-${Date.now()}`;
  },
  createListing: ({ make, model, price }) => {
    const v = { id: String(vehicles.length + 1), make, model, year: 2024, price, isPrivate: false, dealerCost: price * 0.7, sellerSSN: '999-99-9999', sellerEmail: 'new@lab.local' };
    vehicles.push(v); listings.push(v);
    return v;
  },
  updatePrice: ({ id, price }, req) => {
    if (!dealerCtx(req)) throw new Error('dealer context required');
    const v = vehicles.find(x => x.id === String(id));
    if (!v) throw new Error('not found');
    v.price = price; // VULN: presence-only dealer check + allows negative (also covered in REST buy)
    return dealerOnly(req, v);
  },
};
function gqlHandler(label) {
  return graphqlHTTP((req) => ({
    schema, rootValue: root, graphiql: true,
    customFormatErrorFn: (e) => ({ message: e.message }), // terse errors
  }));
}
app.use('/graphql', gqlHandler('public'));
app.use('/graphql-hidden', gqlHandler('hidden')); // undocumented endpoint, same schema
app.use('/api/graphql/v2', gqlHandler('v2'));
// CSRF: mutations accepted over GET with no token
app.get('/graphql-csrf', (req, res) => res.json({ note: 'GraphQL accepts GET requests' }));

// ---------- insecure deserialization ----------
// VULN: node-serialize style func eval + PHP O: parsing + type juggling
app.post('/prefs/load', (req, res) => {
  let { data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'need {data} base64 or raw' });
  try {
    let raw = data;
    try { raw = Buffer.from(data, 'base64').toString(); } catch {}
    if (!raw || raw === data) raw = data;
    // VULN 1: _$$ND_FUNC$$_ RCE gadget (node-serialize pattern)
    if (raw.includes('_$$ND_FUNC$$_')) {
      const idx = raw.indexOf('_$$ND_FUNC$$_');
      let fnStr = raw.slice(idx + '_$$ND_FUNC$$_'.length).trim().replace(/^_/, '');
      // try to extract function(){ body } and execute body
      try {
        const fm = fnStr.match(/function\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
        if (fm) {
          const body = fm[1];
          // VULN: eval gadget body (RCE lab)
          let out;
          try {
            // allow return-style bodies
            out = String(eval(`(function(){${body}})()`));
          } catch (e) { out = 'gadget-error:' + e.message; }
          return res.json({ ok: true, flag: 'LAB{deser_rce}', output: out.slice(0, 500) });
        }
        const { execSync } = require('child_process');
        const out = execSync(`node -e "let f=${fnStr.replace(/\(\)$/, '')}; try{console.log(f())}catch(e){console.log('gadget:'+e.message)}"`, { timeout: 3000 }).toString();
        return res.json({ ok: true, flag: 'LAB{deser_rce}', output: out.slice(0, 500) });
      } catch (e) { return res.json({ ok: true, note: 'gadget attempted', error: String(e.message).slice(0, 300) }); }
    }
    // VULN 2: PHP object injection simulation O:4:"User":...
    if (/^O:\d+:"/.test(raw.trim())) {
      const roleMatch = raw.match(/role[^a-zA-Z0-9]*[;:{"][^}]*?(admin|user)/i);
      const role = roleMatch ? roleMatch[1] : 'user';
      return res.json({ ok: true, deserialized: { __php_object: raw.slice(0, 120), role }, flag: role === 'admin' ? 'LAB{php_object_injection}' : undefined });
    }
    const obj = JSON.parse(raw);
    // VULN 3: type juggling - {"price":{"$type":"number"}} etc.
    if (obj.price && typeof obj.price === 'object' && obj.price.$type) {
      const coerced = obj.price.$type === 'number' ? Number(obj.price.value) : String(obj.price.value);
      return res.json({ ok: true, coerced_price: coerced, note: 'type juggling accepted' });
    }
    // VULN 4: merge into session (also pollution sink)
    unsafeMerge(global.__prefs || (global.__prefs = {}), obj);
    res.json({ ok: true, prefs: global.__prefs });
  } catch (e) { res.status(500).json({ error: 'deser-error:' + e.message }); }
});
app.post('/deserialize/php', (req, res) => {
  const { data } = req.body || {};
  if (!data || !/^O:\d+/.test(data)) return res.status(400).json({ error: 'need PHP serialized O:...' });
  const isAdmin = /admin/i.test(data);
  res.json({ ok: true, role: isAdmin ? 'admin' : 'user', flag: isAdmin ? 'LAB{php_arbitrary_object}' : undefined });
});
app.get('/gadget/info', (req, res) => res.json({
  formats: ['json preferences', 'php-serialized profile import', 'phar image bundle'],
  note: 'see the import documentation in /api/docs',
}));

// ---------- prototype pollution ----------
// VULN: recursive merge with no __proto__/constructor.prototype filter
function unsafeMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (k === '__proto__' && typeof v === 'object' && v !== null) {
      // direct prototype pollution
      Object.assign(Object.prototype, v);
    } else if (k === 'constructor' && v && typeof v === 'object' && v.prototype) {
      Object.assign(Object.prototype, v.prototype); // constructor.prototype bypass
    } else if (v && typeof v === 'object' && typeof target[k] === 'object' && target[k] !== null) {
      unsafeMerge(target[k], v);
    } else {
      // lodash-style assign also vulnerable pre-patch for __proto__ via path; emulate:
      if (k === '__proto__') Object.assign(Object.prototype, v);
      else target[k] = v;
    }
  }
  return target;
}
// also demonstrate lodash merge (still pollutable in some paths if using _.set with user path)
app.post('/prefs/update', (req, res) => {
  // input guard: direct prototype keys are rejected here...
  if (JSON.stringify(req.body || {}).includes('__proto__')) {
    return res.status(400).json({ error: 'invalid preference key' });
  }
  const body = req.body || {};
  // ...but the merge below still follows constructor chains (flawed filter)
  unsafeMerge({}, body);
  try { _.merge({}, body); } catch {}
  // also merge onto global prefs to persist
  unsafeMerge(global.__prefs || (global.__prefs = {}), body);
  res.json({ ok: true, polluted_check: ({}).isAdmin, body });
});
app.put('/prefs/update', (req, res) => {
  if (JSON.stringify(req.body || {}).includes('__proto__')) {
    return res.status(400).json({ error: 'invalid preference key' });
  }
  const body = req.body || {};
  unsafeMerge({}, body);
  try { _.merge({}, body); } catch {}
  unsafeMerge(global.__prefs || (global.__prefs = {}), body);
  res.json({ ok: true, polluted_check: ({}).isAdmin, body });
});
app.post('/prefs/filter-bypass', (req, res) => {
  // VULN: flawed filter blocks __proto__ string but not constructor.prototype
  let raw = JSON.stringify(req.body || {});
  if (raw.includes('__proto__')) return res.status(400).json({ error: 'invalid preference key' });
  unsafeMerge(global.__prefs || (global.__prefs = {}), req.body || {});
  unsafeMerge({}, req.body || {});
  res.json({ ok: true, check: ({}).isAdmin });
});
app.get('/prefs/check', (req, res) => {
  // Detect without polluted-property reflection: returns {}.key for arbitrary key
  const key = req.query.key || 'isAdmin';
  res.json({ key, value: ({} /* polluted prototype */)[key], proto: Object.prototype[key], note: 'if value true -> server-side pollution active' });
});
app.get('/admin-polluted', (req, res) => {
  // VULN: privilege escalation via polluted prototype
  const user = { name: 'wiener' };
  if (user.isAdmin || ({}).isAdmin) return res.json({ admin: true, flag: 'LAB{proto_priv_esc}' });
  res.status(403).json({ error: 'access denied' });
});
app.get('/pollution/rce', (req, res) => {
  // VULN: polluted default used in exec path
  const shell = ({}).shell || 'echo';
  const cmd = `${shell} LAB_pollution_check`;
  try {
    const { execSync } = require('child_process');
    const out = execSync(cmd, { timeout: 2000 }).toString().slice(0, 300);
    res.json({ shell, cmd, output: out, flag: ({}).shell ? 'LAB{proto_rce}' : undefined });
  } catch (e) { res.status(500).json({ error: String(e.message) }); }
});
app.get('/pollution/exfiltrate', (req, res) => {
  // VULN: sensitive default leaked via polluted key read
  const v = ({}).exfil || Object.prototype.exfil;
  res.json({ exfil: v || null, admin_secret: ({}).admin_secret || 'hidden-unless-polluted', note: 'pollute {"__proto__":{"exfil":"/etc/passwd"}} then read' });
});

// ---------- file uploads ----------
// memory storage + manual write with original name (traversal + type confusion preserved)
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function saveVuln(file, opts = {}) {
  let name = file.originalname || 'upload.bin';
  // VULN: null-byte bypass simulation (%00 / \\x00 truncates validation but not write)
  const nullSplit = name.split('%00')[0].split('\x00')[0];
  if (opts.nullByte && name.includes('%00')) name = nullSplit;
  // VULN: path traversal via filename (no basename)
  const dest = path.join(UPLOAD_DIR, name);
  // ensure parent dirs for traversal demo inside uploads only? allow absolute for lab:
  try { fs.mkdirSync(path.dirname(dest), { recursive: true }); } catch {}
  fs.writeFileSync(dest, file.buffer);
  return dest;
}
// 1. no checks -> web shell
app.post('/upload', memUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'need multipart file field' });
  const dest = saveVuln(req.file);
  res.json({ ok: true, path: dest, url: `/files/${req.file.originalname}?exec=1 for RCE lab`, flag: 'LAB{webshell_upload}' });
});
// 2. Content-Type only
app.post('/upload-content-type', memUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'need file' });
  // VULN: trusts attacker Content-Type only
  if (!String(req.file.mimetype).startsWith('image/')) return res.status(400).json({ error: `unsupported media type` });
  const dest = saveVuln(req.file);
  res.json({ ok: true, mimetype: req.file.mimetype, url: `/files/${req.file.originalname}` });
});
// 3. blacklist + content-type (both spoofable, combined bypass needed)
const BLOCKED = ['.php'];
app.post('/upload-blacklist', memUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'need file' });
  const name = req.file.originalname.toLowerCase();
  // VULN: exact .php only (try alternate server-side extensions); mimetype is attacker-controlled
  if (BLOCKED.some(e => name.endsWith(e))) return res.status(400).json({ error: 'blocked file type' });
  if (!String(req.file.mimetype).startsWith('image/')) return res.status(400).json({ error: `blocked mimetype ${req.file.mimetype}` });
  const dest = saveVuln(req.file);
  res.json({ ok: true, url: `/files/${req.file.originalname}`, note: 'photo accepted' });
});
// polyglot helper
app.post('/upload-polyglot', memUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'need file' });
  const head = req.file.buffer.slice(0, 6).toString();
  // VULN: only checks magic bytes GIF89a — polyglot GIF+PHP/JS passes
  if (!(head.startsWith('GIF89') || req.file.mimetype.startsWith('image/'))) return res.status(400).json({ error: 'invalid image file' });
  const dest = saveVuln(req.file);
  res.json({ ok: true, url: `/files/${req.file.originalname}`, flag: 'LAB{polyglot_shell}' });
});
// 4. race: write now, validate after delay
app.post('/upload-race', memUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'need file' });
  const dest = saveVuln(req.file);
  const url = `/files/${req.file.originalname}`;
  res.json({ ok: true, url });
  await sleep(800);
  const isImg = req.file.mimetype.startsWith('image/');
  if (!isImg) { try { fs.unlinkSync(dest); } catch {} }
});
// serve + RCE via ?exec=1 / ?run=1 (requires .js/.phar shell)
app.get('/files/:name', (req, res) => {
  const fp = path.join(UPLOAD_DIR, req.params.name);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'not found (race window closed?)' });
  if (req.query.exec !== undefined || req.query.run !== undefined) {
    // VULN: server-side include / eval of uploaded shell
    try {
      const content = fs.readFileSync(fp, 'utf8');
      if (fp.endsWith('.js')) {
        const { execSync } = require('child_process');
        // if shell contains child_process, run it; else eval length
        if (content.includes('execSync') || content.includes('require(')) {
          const out = execSync(`node "${fp}"`, { timeout: 2000 }).toString().slice(0, 1000);
          return res.json({ executed: true, output: out, flag: 'LAB{upload_rce}' });
        }
        return res.json({ content: content.slice(0, 1000) });
      }
      return res.json({ content: fs.readFileSync(fp, 'utf8').slice(0, 1000) });
    } catch (e) { return res.status(500).json({ error: String(e.message) }); }
  }
  res.sendFile(fp);
});

// ---------- path traversal ----------
function traversalRead(variant, fileParam) {
  const base = path.join(__dirname, 'images');
  let f = fileParam || '';
  if (variant === 'strip') f = f.replace('../', ''); // VULN: non-recursive strip (....// bypass)
  else if (variant === 'decode') { try { f = decodeURIComponent(f); } catch {} } // superfluous decode: %252e -> ..
  else if (variant === 'start') {
    if (!f.startsWith('uploads/')) throw new Error('invalid image path');
    // then join from catalog root (allows escape)
    return fs.readFileSync(path.join(__dirname, f), 'utf8');
  } else if (variant === 'nullbyte') {
    // check extension before null byte stripped
    const clean = f.split('%00')[0].split('\x00')[0];
    if (!f.endsWith('.jpg')) throw new Error('only .jpg images are served');
    f = clean;
    // try images then root
    const p1 = path.join(base, f);
    if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
    return fs.readFileSync(path.join(__dirname, f), 'utf8');
  } else if (variant === 'absolute') {
    if (path.isAbsolute(f)) return fs.readFileSync(f, 'utf8'); // absolute bypass
  }
  // simple + absolute + strip + decode all join without canonicalize
  return fs.readFileSync(path.join(base, f), 'utf8');
}
for (const v of ['image', 'image-absolute', 'image-strip', 'image-decode', 'image-start', 'image-nullbyte']) {
  app.get(`/${v}`, (req, res) => {
    const variant = v.replace('image', '').replace('-', '') || 'simple';
    const map = { '': 'simple', absolute: 'absolute', strip: 'strip', decode: 'decode', start: 'start', nullbyte: 'nullbyte' };
    try {
      const content = traversalRead(map[variant] || 'simple', req.query.file || req.query.filename || '');
      res.json({ ok: true, file: req.query.file, content: String(content).slice(0, 2000) });
    } catch (e) { res.status(404).json({ error: 'image not found' }); }
  });
}

// ---------- race conditions ----------
const RL = {}; // ip -> timestamps
app.get('/rate-limit-test', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'x').split(',')[0];
  const now = Date.now();
  RL[ip] = (RL[ip] || []).filter(t => now - t < 60000);
  const seen = RL[ip].length; // VULN: check before delay
  await sleep(150); // parallel requests all see same count -> bypass
  if (seen >= 5) return res.status(429).json({ error: 'rate limited, try again later' });
  RL[ip].push(now);
  res.json({ ok: true, count: RL[ip].length });
});
app.post('/coupon/apply', async (req, res) => {
  const { code } = req.body || {};
  const c = coupons[code];
  if (!c) return res.status(404).json({ error: 'bad code' });
  const seen = c.uses; // VULN: TOCTOU - all parallel see same value
  await sleep(200); // widen window: limit overrun / single-endpoint race
  if (seen >= c.max) return res.status(400).json({ error: 'coupon exhausted', uses: c.uses, max: c.max });
  c.uses++;
  res.json({ ok: true, uses: c.uses, max: c.max, flag: c.uses > c.max ? 'LAB{race_overrun}' : (c.uses === c.max ? 'at-limit (race 6 parallel to overrun)' : undefined) });
});
app.get('/balance/check', (req, res) => res.json({ balances: BALANCES }));
app.post('/balance/withdraw', async (req, res) => {
  // VULN: multi-endpoint TOCTOU - check + withdraw separate from /balance/check
  const { user, amount } = req.body || {};
  const amt = Number(amount);
  const bal = BALANCES[user] || 0; // snapshot before delay
  await sleep(200);
  if (bal < amt) return res.status(400).json({ error: 'insufficient' });
  BALANCES[user] = (BALANCES[user] || 0) - amt; // parallel double-spend -> negative
  res.json({ ok: true, balance: BALANCES[user], flag: BALANCES[user] < 0 ? 'LAB{race_negative}' : undefined });
});
app.post('/buy-race', async (req, res) => {
  // single-endpoint time-sensitive race
  const { user = 'wiener', vehicleId = '1' } = req.body || {};
  const v = vehicles.find(x => x.id === String(vehicleId));
  if (!v) return res.status(404).json({ error: 'no vehicle' });
  const bal = BALANCES[user] || 0;
  await sleep(250);
  if (bal < v.price) return res.status(400).json({ error: 'insufficient (race two buys in parallel)' });
  BALANCES[user] -= v.price;
  res.json({ ok: true, balance: BALANCES[user] });
});
app.post('/listing/create-partial', async (req, res) => {
  // partial construction: draft then auto-publish before validation
  const draft = { id: `d${Date.now()}`, status: 'draft', ...req.body };
  listings.push(draft);
  const id = draft.id;
  res.json({ ok: true, id, status: 'draft', publish: `/listing/publish?id=${id}`, note: 'publish before validation completes (partial-construction race)' });
  await sleep(1000);
  draft.validated = true;
});
app.post('/listing/publish', (req, res) => {
  const id = req.query.id || (req.body || {}).id;
  const l = listings.find(x => x.id === id);
  if (!l) return res.status(404).json({ error: 'no draft' });
  if (!l.validated) {
    l.status = 'published';
    return res.json({ ok: true, flag: 'LAB{partial_construction}', listing: l });
  }
  l.status = 'published';
  res.json({ ok: true, listing: l });
});

// ---------- business logic ----------
app.post('/buy', (req, res) => {
  const { vehicleId = '1', price, user = 'wiener', quantity = 1 } = req.body || {};
  const v = vehicles.find(x => x.id === String(vehicleId));
  if (!v) return res.status(404).json({ error: 'no vehicle' });
  let p = price !== undefined ? price : v.price;
  if (Array.isArray(p)) p = Number(p[0]);
  if (typeof p === 'string') { if (p.startsWith('$')) p = p.slice(1); p = Number(p); }
  if (Number.isNaN(p)) p = 0;
  if (typeof p === 'number' && p < 0) return res.status(400).json({ error: 'price must be positive' });
  // VULN: quantity is never validated - negative quantities credit the balance
  const total = Number(p) * Number(quantity);
  BALANCES[user] = (BALANCES[user] || 0) - total;
  const flag = total < 0 ? 'LAB{infinite_money}' : (total === 0 ? 'LAB{zero_price}' : undefined);
  res.json({ ok: true, vehicle: v.id, charged: total, balance: BALANCES[user], flag });
});
app.post('/coupon/dual-use', (req, res) => {
  // VULN: weak isolation dual-use endpoint: action=apply|refund same code path
  const { code = 'WELCOME10', action = 'apply', user = 'wiener' } = req.body || {};
  if (action === 'refund') {
    BALANCES[user] = (BALANCES[user] || 0) + 100; // refunds without ever charging
    return res.json({ ok: true, balance: BALANCES[user], flag: 'LAB{dual_use_refund}' });
  }
  const c = coupons[code];
  if (c) { c.uses++; BALANCES[user] = (BALANCES[user] || 0) - 10; }
  res.json({ ok: true, balance: BALANCES[user] });
});
app.post('/checkout/select', (req, res) => {
  const user = (req.body || {}).user || 'wiener';
  checkoutState[user] = 'selected';
  res.json({ ok: true, next: '/checkout/pay' });
});
app.post('/checkout/pay', (req, res) => {
  const user = (req.body || {}).user || 'wiener';
  if (checkoutState[user] !== 'selected') return res.status(400).json({ error: 'invalid checkout state' });
  checkoutState[user] = 'paid';
  res.json({ ok: true, next: '/checkout/confirm' });
});
app.post('/checkout/confirm', (req, res) => {
  // VULN: insufficient workflow validation - confirms even if never paid
  const user = (req.body || {}).user || 'wiener';
  if (checkoutState[user] === 'paid') { checkoutState[user] = 'done'; return res.json({ ok: true, done: true }); }
  checkoutState[user] = 'done';
  res.json({ ok: true, flag: 'LAB{workflow_bypass}' });
});

// ---------- misc ----------
app.get('/api/docs', (req, res) => res.json({ service: 'catalog', version: '2.4.1', endpoints: ['GET /vehicles/search', 'GET /vehicles/:id', 'POST /graphql', 'GET /files/:name', 'GET /image', 'POST /buy', 'POST /coupon/apply'] }));
app.get('/v1/dealers', (req, res) => res.json({ dealers: DEALERS }));
app.get('/v1/news', (req, res) => res.json({ articles: NEWS }));
app.get('/v1/news/:id', (req, res) => {
  const a = NEWS.find(x => x.id === String(req.params.id));
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a);
});
app.get('/api/unused', (req, res) => res.json({ service: 'catalog', note: 'no deprecated endpoints' }));

/* ================= Phase 9: commerce races / PP gadget / cache ================= */
const P9 = {
  gift: { 'GC-P9-ADMIN': { max: 1, used: 0, value: 2500 } },
  wallet: { primary: 20000, replica: 20000, carlos: 20000 },
  fx: { usd: 10000, eur: 0, conversions: 0 },
  cart: { vehicle: {}, price: {} }
};

function resetPhase9() {
  P9.gift['GC-P9-ADMIN'] = { max: 1, used: 0, value: 2500 };
  P9.wallet.primary = 20000;
  P9.wallet.replica = 20000;
  P9.wallet.carlos = 20000;
  P9.fx.usd = 10000;
  P9.fx.eur = 0;
  P9.fx.conversions = 0;
  for (const k of Object.keys(P9.cart.vehicle)) delete P9.cart.vehicle[k];
  for (const k of Object.keys(P9.cart.price)) delete P9.cart.price[k];
  try { fs.unlinkSync('/tmp/pp_gadget_pwned'); } catch (e) {}
}

app.post('/v1/auth/demo-session', (req, res) => {
  res.cookie('automarket_admin', '1', { httpOnly: false, sameSite: 'Lax' });
  res.json({ ok: true, session: 'automarket_admin', note: 'demo dealer-admin session cookie issued' });
});

app.post('/v1/giftcards/redeem', async (req, res) => {
  const { code = 'GC-P9-ADMIN' } = req.body || {};
  const card = P9.gift[code];
  if (!card) return res.status(404).json({ error: 'gift card not found' });
  const remaining = card.max - card.used;
  await sleep(250);
  if (remaining <= 0) return res.status(409).json({ error: 'gift card already redeemed' });
  card.used += 1;
  const overRedeemed = card.used > card.max;
  res.json({ ok: true, code, credited: card.value, uses: card.used,
             flag: overRedeemed ? 'LAB{giftcard_redeem_race}' : undefined });
});

app.post('/v1/wallets/transfer', async (req, res) => {
  const { from = 'wiener', to = 'carlos', amount = 0 } = req.body || {};
  const amt = Number(amount) || 0;
  const snapshot = from === 'wiener' ? P9.wallet.primary : P9.wallet[from];
  await sleep(250);
  if ((snapshot || 0) < amt) return res.status(400).json({ error: 'insufficient funds' });
  if (from === 'wiener') P9.wallet.primary -= amt; else P9.wallet[from] = (P9.wallet[from] || 0) - amt;
  if (to === 'wiener') P9.wallet.primary += amt; else P9.wallet[to] = (P9.wallet[to] || 0) + amt;
  const overdrawn = (from === 'wiener' ? P9.wallet.primary : P9.wallet[from]) < 0;
  res.json({ ok: true, from, to, amount: amt, balances: P9.wallet,
             flag: overdrawn ? 'LAB{wallet_transfer_double_spend}' : undefined });
});

app.post('/v1/wallets/withdraw', async (req, res) => {
  const { user = 'wiener', amount = 0 } = req.body || {};
  const amt = Number(amount) || 0;
  const replicaBalance = P9.wallet.replica;
  await sleep(200);
  if (replicaBalance < amt) return res.status(400).json({ error: 'insufficient funds' });
  if (user === 'wiener') P9.wallet.primary -= amt; else P9.wallet[user] = (P9.wallet[user] || 0) - amt;
  const current = user === 'wiener' ? P9.wallet.primary : P9.wallet[user];
  res.json({ ok: true, user, amount: amt, replica_balance_seen: replicaBalance, current_balance: current,
             flag: current < 0 ? 'LAB{replica_lag_withdraw}' : undefined });
});

app.post('/v1/wallets/deposit', (req, res) => {
  const { amount = 0 } = req.body || {};
  P9.wallet.primary += Number(amount) || 0;
  setTimeout(() => { P9.wallet.replica = P9.wallet.primary; }, 1200);
  res.json({ ok: true, primary: P9.wallet.primary, replica_lag_ms: 1200 });
});

app.post('/v1/fx/convert', (req, res) => {
  const { direction } = req.body || {};
  if (direction === 'usd-eur') {
    P9.fx.eur += Math.floor(P9.fx.usd * 0.90);
    P9.fx.usd = 0;
  } else if (direction === 'eur-usd') {
    P9.fx.usd += Math.ceil(P9.fx.eur * 1.12);
    P9.fx.eur = 0;
  } else {
    return res.status(400).json({ error: 'direction must be usd-eur or eur-usd' });
  }
  P9.fx.conversions++;
  res.json({ ok: true, balances: { usd_cents: P9.fx.usd, eur_cents: P9.fx.eur }, conversions: P9.fx.conversions,
             flag: P9.fx.usd >= 10050 && P9.fx.conversions >= 2 ? 'LAB{currency_rounding_arb}' : undefined });
});

app.post('/v1/checkout/cart', async (req, res) => {
  const { user = 'wiener', vehicleId } = req.body || {};
  const v = vehicles.find(x => x.id === String(vehicleId));
  if (!v) return res.status(404).json({ error: 'vehicle not found' });
  P9.cart.vehicle[user] = v.id;
  await sleep(300);
  P9.cart.price[user] = v.price;
  res.json({ ok: true, cart: { user, vehicleId: v.id, price: v.price } });
});

app.post('/v1/checkout/confirm', (req, res) => {
  const { user = 'wiener' } = req.body || {};
  const vehicleId = P9.cart.vehicle[user];
  const charged = P9.cart.price[user];
  const v = vehicles.find(x => x.id === String(vehicleId));
  if (!v || charged === undefined) return res.status(400).json({ error: 'no pending cart' });
  const swapped = Number(charged) !== Number(v.price);
  res.json({ ok: true, order: { user, vehicleId, vehicle_price: v.price, charged },
             flag: swapped ? 'LAB{checkout_cart_swap}' : undefined,
             note: swapped ? 'cart line item and captured price came from different checkout attempts' : 'consistent cart' });
});

app.get('/v1/dealers/promo', (req, res) => {
  const override = req.headers['x-original-url'] || req.headers['x-rewrite-url'] || req.headers['x-forwarded-host'] || '';
  res.json({
    ok: true,
    campaign: 'Summer Clearance',
    banner_url: override ? 'https://ads.automarket-cdn.example' + String(override).slice(0, 160) : '/promos/summer-clearance.jpg',
    poisoned: !!override,
    flag: override ? 'LAB{cache_poison_unkeyed_header}' : undefined
  });
});

app.post('/v1/dealers/invoices/render', (req, res) => {
  const { template = 'Invoice', dealer = 'dealer' } = req.body || {};
  const outputFunctionName = ({}).outputFunctionName || 'renderFn';
  let error = null;
  try {
    const runner = new Function('var ' + outputFunctionName + ';\nreturn 1;');
    runner();
  } catch (e) {
    error = String(e.message).slice(0, 200);
  }
  const pwned = fs.existsSync('/tmp/pp_gadget_pwned');
  res.json({
    ok: true,
    rendered: String(template).slice(0, 2000),
    dealer,
    output_function_name: outputFunctionName,
    error,
    flag: pwned ? 'LAB{proto_template_gadget}' : undefined
  });
});

app.listen(PORT, () => console.log(`catalog lab on ${PORT}`));

/* ============================================================================
 * Production façade (public benchmark surface). Realistic storefront paths.
 * Legacy paths keep working but are undocumented (regression only).
 * ========================================================================== */
const _http = require('http');
function forward(to) {
  return (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    // body already consumed by parsers; reuse captured raw bytes (multipart routes use own handlers)
    let body = req.rawBody && req.rawBody.length ? req.rawBody : Buffer.alloc(0);
    const ctype = String(req.headers['content-type'] || '');
    if (!body.length && req.body && typeof req.body === 'object') {
      body = ctype.includes('x-www-form-urlencoded')
        ? Buffer.from(new URLSearchParams(req.body).toString())
        : Buffer.from(JSON.stringify(req.body));
    }
    const headers = { ...req.headers, host: `127.0.0.1:${PORT}` };
    delete headers['content-length'];
    const preq = _http.request({ host: '127.0.0.1', port: PORT, path: to + qs, method: req.method, headers: { ...headers, 'content-length': body.length } }, pres => {
      res.status(pres.statusCode);
      for (const [k, v] of Object.entries(pres.headers)) { try { res.set(k, v); } catch {} }
      pres.pipe(res);
    });
    preq.on('error', e => { if (!res.headersSent) res.status(502).json({ error: 'facade:' + e.message }); });
    preq.end(body);
  };
}
// dealer auth + search (NoSQL surface)
app.post('/v1/dealers/login', forward('/auth/login'));
app.get('/v1/vehicles/search', (req, res) => {
  try {
    // storefront filters: ?q= model/make text, ?make=, ?maxPrice=, ?minYear=
    const q = (req.query.q || req.query.make || '').toLowerCase();
    const maxPrice = parseFloat(req.query.maxPrice);
    const minYear = parseInt(req.query.minYear, 10);
    const nosqlQ = { ...req.query };
    for (const k of ['q', 'make', 'maxPrice', 'minYear', 'utm', 'utm_content', 'debug']) delete nosqlQ[k];
    const hit = findVehicles(nosqlQ).filter(v => {
      if (q && !(v.make + ' ' + v.model).toLowerCase().includes(q)) return false;
      if (!isNaN(maxPrice) && Number(v.price) > maxPrice) return false;
      if (!isNaN(minYear) && Number(v.year) < minYear) return false;
      return true;
    });
    res.set('Cache-Control', 'public, max-age=60'); // storefront caching (unkeyed UA/utm)
    res.json({ query: req.query, count: hit.length, results: hit,
      meta: { ua: req.headers['user-agent'] || '', utm: req.query.utm_content || req.query.utm || '' } });
  } catch (e) { res.status(500).json({ error: String(e.message) }); }
});
app.post('/v1/vehicles/search', (req, res) => {
  try {
    const hit = findVehicles(req.body || {});
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ query: req.body, count: hit.length, results: hit,
      meta: { ua: req.headers['user-agent'] || '' } });
  } catch (e) { res.status(500).json({ error: String(e.message) }); }
});
app.get('/v1/vehicles/:id', (req, res) => {
  const v = vehicles.find(x => x.id === String(req.params.id));
  if (!v) return res.status(404).json({ error: 'not found' });
  res.json(v);
});
// listings + pricing (business-logic surface)
app.post('/v1/listings', (req, res) => {
  const { make = 'Used', model = 'Car', price = 1000 } = req.body || {};
  // numeric negatives are rejected; other types are coerced below
  if (typeof price === 'number' && price < 0) return res.status(400).json({ error: 'price must be positive' });
  const v = { id: String(vehicles.length + 1), make, model, year: 2024, price: Number(price),
    isPrivate: false, dealerCost: Number(price) * 0.7, sellerSSN: '999-99-9999', sellerEmail: 'new@lab.local' };
  vehicles.push(v); listings.push(v);
  res.json(v);
});
app.patch('/v1/listings/:id/price', (req, res) => {
  // presence-only dealer check: any value passes
  if (!req.headers['x-dealer-token']) return res.status(403).json({ error: 'dealer context required' });
  const v = vehicles.find(x => x.id === String(req.params.id));
  if (!v) return res.status(404).json({ error: 'not found' });
  v.price = Number((req.body || {}).price);
  res.json(v);
});
// photos (upload + traversal surface)
app.post('/v1/listings/:id/photos', memUpload.any(), (req, res) => {
  const f = (req.files || [])[0] || req.file;
  if (!f) return res.status(400).json({ error: 'attach a photo' });
  const dest = saveVuln({ originalname: f.originalname, buffer: f.buffer });
  res.json({ ok: true, url: `/v1/photos/${f.originalname}`, path: dest });
});
app.get('/v1/photos/:name', (req, res) => forward('/files/' + encodeURIComponent(req.params.name))(req, res));
app.get('/v1/gallery', (req, res) => {
  // product image viewer; strips parent-directory references once
  const base = path.join(__dirname, 'images');
  let f = req.query.file || '';
  f = f.replace('../', '');
  try {
    const content = fs.readFileSync(path.join(base, f), 'utf8');
    res.json({ ok: true, file: req.query.file, content: String(content).slice(0, 2000) });
  } catch (e) { res.status(404).json({ error: 'image not found' }); }
});
// account (preferences / pollution / deser surface)
app.put('/v1/account/preferences', forward('/prefs/update'));
app.get('/v1/account/role', forward('/admin-polluted'));
app.post('/v1/account/import', forward('/prefs/load'));
// promotions + orders + checkout (race / workflow surface)
app.post('/v1/promotions/apply', forward('/coupon/apply'));
app.get('/v1/account/balance', forward('/balance/check'));
app.post('/v1/orders', forward('/buy'));
app.post('/v1/checkout/select', forward('/checkout/select'));
app.post('/v1/checkout/pay', forward('/checkout/pay'));
app.post('/v1/checkout/confirm', forward('/checkout/confirm'));

// ---------- B2B Dealer Wholesale & Consignment Exchange (Chain 1) ----------
const WHOLESALE_LOTS = [
  { lotId: 'LOT-501', make: 'BMW', model: 'M4 Competition', year: 2022, reservePrice: 42000, currentBid: 43500, status: 'OPEN', consignmentId: 'CSG-88219' },
  { lotId: 'LOT-502', make: 'Porsche', model: 'Taycan 4S', year: 2021, reservePrice: 65000, currentBid: 67000, status: 'OPEN', consignmentId: 'CSG-88220' },
  { lotId: 'LOT-503', make: 'Mercedes-Benz', model: 'G63 AMG', year: 2020, reservePrice: 85000, currentBid: 89000, status: 'LOCKED', consignmentId: 'CSG-88221' },
  { lotId: 'LOT-504', make: 'Audi', model: 'RS e-tron GT', year: 2023, reservePrice: 79000, currentBid: 82500, status: 'OPEN', consignmentId: 'CSG-88222' },
  { lotId: 'LOT-505', make: 'Tesla', model: 'Model X Plaid', year: 2022, reservePrice: 68000, currentBid: 71000, status: 'OPEN', consignmentId: 'CSG-88223' },
  { lotId: 'LOT-506', make: 'Land Rover', model: 'Range Rover SV', year: 2023, reservePrice: 125000, currentBid: 129000, status: 'OPEN', consignmentId: 'CSG-88224' },
  { lotId: 'LOT-507', make: 'Lexus', model: 'LC 500 Convertible', year: 2022, reservePrice: 59000, currentBid: 61500, status: 'LOCKED', consignmentId: 'CSG-88225' },
  { lotId: 'LOT-508', make: 'Aston Martin', model: 'DBX 707', year: 2023, reservePrice: 145000, currentBid: 148000, status: 'OPEN', consignmentId: 'CSG-88226' },
];
const WHOLESALE_SECRET = 'DISP-WHOLESALE-SECRET-99';

app.get('/v1/dealers/wholesale/inventory', (req, res) => {
  res.json({ ok: true, lots: WHOLESALE_LOTS, exchange: 'AutoMarket B2B Wholesale Clearinghouse' });
});

app.get('/v1/dealers/wholesale/appraisals/public-stats', (req, res) => {
  // Public statistics on wholesale activity
  const verbose = req.query.verbose === 'true' || req.query.debug === '1';
  const out = {
    total_lots: WHOLESALE_LOTS.length,
    active_bids: WHOLESALE_LOTS.filter(l => l.status === 'OPEN').length,
    market_clearing_index: 104.8
  };
  if (verbose) {
    // VULN: Information disclosure leaks consignment secret key & signing format
    out.clearinghouse_debug = {
      consignment_salt: WHOLESALE_SECRET,
      sig_formula: 'sha256(lotId:dealerId:WHOLESALE_SECRET)',
      supported_superadmin_tiers: ['superadmin'],
      master_lot: 'LOT-501'
    };
  }
  res.json(out);
});

app.post('/v1/dealers/wholesale/bids', (req, res) => {
  const { lotId, amount, dealerId, signature } = req.body || {};
  if (!lotId || !amount || !dealerId) return res.status(400).json({ error: 'lotId, amount, and dealerId required' });
  const lot = WHOLESALE_LOTS.find(l => l.lotId === lotId);
  if (!lot) return res.status(404).json({ error: 'lot not found' });
  
  // Verification: requires signature computed with leaked WHOLESALE_SECRET
  const dealerStr = typeof dealerId === 'object' ? JSON.stringify(dealerId) : String(dealerId);
  const crypto = require('crypto');
  const expectedSig = crypto.createHash('sha256').update(`${lotId}:${dealerStr}:${WHOLESALE_SECRET}`).digest('hex');
  
  // VULN: loose comparison or tier bypass or exact signature match
  const isSuperTier = (typeof dealerId === 'object' && dealerId.tier === 'superadmin') || (Array.isArray(dealerId) && dealerId.includes('superadmin'));
  if (signature === expectedSig || isSuperTier || signature === 'BYPASS_DEBUG_SIG') {
    lot.currentBid = Math.max(Number(amount), lot.currentBid);
    const contract_ticket = Buffer.from(JSON.stringify({
      lotId,
      dealerId,
      amount,
      consignmentId: lot.consignmentId,
      approved: true,
      ts: Date.now()
    })).toString('base64url');
    return res.json({
      ok: true,
      message: 'Wholesale acquisition bid placed successfully',
      lotId,
      currentBid: lot.currentBid,
      contract_ticket,
      next_step: 'Export settlement contract via POST /v1/dealers/wholesale/contracts/export'
    });
  }
  return res.status(401).json({ error: 'Invalid dealer consignment signature', expected_format: 'sha256(lotId:dealerId:WHOLESALE_SECRET)' });
});

app.post('/v1/dealers/wholesale/contracts/export', (req, res) => {
  const { contract_ticket, template_url } = req.body || {};
  if (!contract_ticket) return res.status(400).json({ error: 'contract_ticket required' });
  try {
    const raw = Buffer.from(contract_ticket, 'base64url').toString('utf8');
    const ticket = JSON.parse(raw);
    if (!ticket.approved) return res.status(403).json({ error: 'unapproved ticket' });
    
    if (template_url) {
      // VULN: SSRF - fetches arbitrary internal / external URL
      try {
        const u = new URL(template_url);
        const mod = u.protocol === 'https:' ? require('https') : require('http');
        const sreq = mod.get(template_url, { timeout: 4000 }, (sres) => {
          let data = '';
          sres.on('data', chunk => data += chunk);
          sres.on('end', () => {
            res.json({
              ok: true,
              contract_id: 'CTR-' + Date.now(),
              lotId: ticket.lotId,
              dealerId: ticket.dealerId,
              template_status: sres.statusCode,
              rendered_template: data.slice(0, 4000),
              flag: 'LAB{dealer_chain_wholesale_contract_ssrf}',
              clearing_status: 'EXCHANGED'
            });
          });
        });
        sreq.on('error', err => {
          res.json({
            ok: true,
            contract_id: 'CTR-' + Date.now(),
            lotId: ticket.lotId,
            dealerId: ticket.dealerId,
            template_fetch_error: err.message,
            flag: 'LAB{dealer_chain_wholesale_contract_ssrf}',
            clearing_status: 'EXCHANGED_FALLBACK'
          });
        });
        return;
      } catch (err) {
        return res.status(400).json({ error: 'invalid template_url: ' + err.message });
      }
    }
    res.json({ ok: true, ticket, note: 'provide template_url to fetch partner styling' });
  } catch (e) {
    res.status(400).json({ error: 'malformed contract_ticket: ' + e.message });
  }
});

// ---------- Customer Concierge & Services (Chain 3 Step 1) ----------
const CONCIERGE_BOOKINGS = [
  {
    id: 'BK-101',
    customerName: 'Aarav Mehta',
    vehicleId: '4',
    preferredTime: '10:00 AM Tomorrow',
    deliveryAddress: 'Skyline Penthouse 4, Worli, Mumbai',
    customInstructions: 'Please ensure car is charged to 90% and bring the certified inspection log.',
    status: 'CONFIRMED',
    created: '2026-10-17T10:00:00Z'
  },
  {
    id: 'BK-102',
    customerName: 'Dr. Siddharth Malhotra',
    vehicleId: '31',
    preferredTime: '2:30 PM Wednesday',
    deliveryAddress: 'Golf Links Villa 12, New Delhi',
    customInstructions: 'Client requests flatbed trailer delivery for private track evaluation at BIC.',
    status: 'CONFIRMED',
    created: '2026-10-17T14:15:00Z'
  },
  {
    id: 'BK-103',
    customerName: 'Rohan Singhania',
    vehicleId: '32',
    preferredTime: '11:00 AM Thursday',
    deliveryAddress: 'UB City Residence Tower B, Bengaluru',
    customInstructions: 'Bring full Carfax mechanical telemetry and carbon bucket seat adjustment tools.',
    status: 'CONFIRMED',
    created: '2026-10-18T09:30:00Z'
  },
  {
    id: 'BK-104',
    customerName: 'Meera Deshmukh',
    vehicleId: '34',
    preferredTime: '4:00 PM Friday',
    deliveryAddress: 'Koregaon Park Avenue 5, Pune',
    customInstructions: 'Demonstrate Full Self-Driving hardware 4 beta and home Wall Connector setup.',
    status: 'CONFIRMED',
    created: '2026-10-18T11:45:00Z'
  },
  {
    id: 'BK-105',
    customerName: 'Ananya Birla',
    vehicleId: '38',
    preferredTime: '1:00 PM Saturday',
    deliveryAddress: 'Boat Club Road, Chennai',
    customInstructions: 'Family 7-seat configuration test and child booster seat compatibility check.',
    status: 'CONFIRMED',
    created: '2026-10-18T16:20:00Z'
  }
];

app.post('/v1/customers/concierge/book', (req, res) => {
  const { customerName, vehicleId, preferredTime, deliveryAddress, customInstructions } = req.body || {};
  if (!customerName || !vehicleId) return res.status(400).json({ error: 'customerName and vehicleId required' });
  const id = 'BK-' + (CONCIERGE_BOOKINGS.length + 101);
  const booking = {
    id,
    customerName,
    vehicleId: String(vehicleId),
    preferredTime: preferredTime || 'Flexible',
    deliveryAddress: deliveryAddress || 'Customer Doorstep',
    customInstructions: customInstructions || 'Standard white-glove handover',
    status: 'CONFIRMED',
    created: new Date().toISOString()
  };
  CONCIERGE_BOOKINGS.push(booking);
  res.json({
    ok: true,
    bookingId: id,
    message: 'VIP Concierge test-drive scheduled successfully',
    booking
  });
});

app.get('/v1/customers/concierge/bookings', (req, res) => {
  res.json({ ok: true, bookings: CONCIERGE_BOOKINGS });
});

app.get('/v1/customers/concierge/bookings/:id', (req, res) => {
  const b = CONCIERGE_BOOKINGS.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'booking not found' });
  res.json({ ok: true, booking: b });
});

const WATCHLIST = {};
app.post('/v1/customers/watchlist', (req, res) => {
  const { username = 'wiener', vehicleId } = req.body || {};
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId required' });
  WATCHLIST[username] = WATCHLIST[username] || [];
  if (!WATCHLIST[username].includes(vehicleId)) WATCHLIST[username].push(vehicleId);
  res.json({ ok: true, watchlist: WATCHLIST[username] });
});

app.get('/v1/customers/watchlist', (req, res) => {
  const user = req.query.username || 'wiener';
  res.json({ ok: true, username: user, watchlist: WATCHLIST[user] || [] });
});

app.get('/v1/customers/service-history/:vin', (req, res) => {
  const vin = req.params.vin;
  const records = [
    { date: '2025-08-14', type: 'Annual Maintenance', km: 24000, provider: 'AutoMarket Authorized Tech', notes: 'Brake pads inspected, cabin filter replaced' },
    { date: '2024-09-02', type: 'Battery Diagnostics & Firmware Update', km: 12000, provider: 'OEM Supercenter', notes: 'Health score 99%, coolant flushed' }
  ];
  res.json({ ok: true, vin, records });
});

// Internal test helper (not part of the public storefront surface).
const PROTO_BASELINE = new Set(Object.getOwnPropertyNames(Object.prototype));
app.post('/v1/internal/reset', (req, res) => {
  vehicles.splice(0, vehicles.length, ...JSON.parse(JSON.stringify(PRISTINE_VEHICLES)));
  listings.length = 0;
  for (const k of Object.keys(checkoutState)) delete checkoutState[k];
  for (const k of Object.keys(BALANCES)) delete BALANCES[k];
  Object.assign(BALANCES, { wiener: 20000, carlos: 20000 });
  for (const k of Object.keys(coupons)) delete coupons[k];
  coupons.WELCOME10 = { uses: 0, max: 5, discount: 10 };
  for (const k of Object.getOwnPropertyNames(Object.prototype))
    if (!PROTO_BASELINE.has(k)) { try { delete Object.prototype[k]; } catch {} }
  DOC_FETCH_LOG.length = 0;
  for (const k of Object.keys(WALLET_CREDITS)) delete WALLET_CREDITS[k];
  Object.assign(WALLET_CREDITS, { d1: 0, d2: 0, d3: 0, d4: 0 });
  ADMIN_ONBOARDING.splice(0, ADMIN_ONBOARDING.length,
    { id: 'app-901', dealer: 'Skyline Performance Imports', notes: 'Standard onboarding review. Vehicle import docs attached for compliance.', status: 'pending', flag: null });
  WHOLESALE_LOTS.splice(0, WHOLESALE_LOTS.length,
    { lotId: 'LOT-501', make: 'BMW', model: 'M4 Competition', year: 2022, reservePrice: 42000, currentBid: 43500, status: 'OPEN', consignmentId: 'CSG-88219' },
    { lotId: 'LOT-502', make: 'Porsche', model: 'Taycan 4S', year: 2021, reservePrice: 65000, currentBid: 67000, status: 'OPEN', consignmentId: 'CSG-88220' },
    { lotId: 'LOT-503', make: 'Mercedes-Benz', model: 'G63 AMG', year: 2020, reservePrice: 85000, currentBid: 89000, status: 'LOCKED', consignmentId: 'CSG-88221' }
  );
  CONCIERGE_BOOKINGS.splice(1);
  resetPhase9();
  res.json({ ok: true });
});

/* Node.js template engine SSTI - dealer invoice custom template */
app.post('/v1/dealers/wholesale/invoice-template', (req, res) => {
  const ejs = require('ejs');
  const { template, dealer } = req.body || {};
  if (!template) return res.status(400).json({ error: 'template required' });
  try {
    const out = ejs.render(template, { dealer: dealer || 'dealer', client: req });
    const flagged = /require|process|mainModule|__proto__|constructor/.test(template);
    res.json({ rendered: String(out).slice(0, 2000), flag: flagged ? 'LAB{nodejs_ssti}' : null });
  } catch (e) {
    res.status(500).json({ error: 'template error: ' + e.message.slice(0, 200) });
  }
});

/* CBC padding oracle - dealer payment confirmation decryptor */
const CBC_KEY = Buffer.from('LAB_CBC_KEY_16BY');
function pad(s) { const p = 16 - (s.length % 16); return s + String.fromCharCode(p).repeat(p); }
function unpad(b) { const p = b[b.length - 1]; if (p < 1 || p > 16) throw new Error('Invalid padding'); for (let i = 0; i < p; i++) { if (b[b.length - 1 - i] !== p) throw new Error('Invalid padding'); } return b.slice(0, b.length - p); }

app.post('/v1/payments/decrypt', (req, res) => {
  const { ciphertext_hex } = req.body || {};
  try {
    const { createDecipheriv } = require('crypto');
    const ct = Buffer.from(ciphertext_hex, 'hex');
    const iv = ct.slice(0, 16);
    const body = ct.slice(16);
    const d = createDecipheriv('aes-128-cbc', CBC_KEY, iv);
    d.setAutoPadding(false);
    const pt = Buffer.concat([d.update(body), d.final()]);
    const plain = unpad(pt);
    res.json({ decrypted: plain.toString('utf8') });
  } catch (e) {
    // VULN: distinct error for padding vs other failures = padding oracle
    if (e.message.includes('padding')) return res.status(400).json({ error: 'Invalid Padding' });
    res.status(500).json({ error: 'Decryption failed' });
  }
});

app.post('/v1/payments/create', (req, res) => {
  const { plaintext } = req.body || {};
  const { createCipheriv } = require('crypto');
  const iv = Buffer.from('1234567890abcdef', 'utf8');
  const c = createCipheriv('aes-128-cbc', CBC_KEY, iv);
  c.setAutoPadding(false);
  const ct = Buffer.concat([iv, c.update(pad(String(plaintext))), c.final()]);
  res.json({ ciphertext_hex: ct.toString('hex') });
});

/* ============ Dealer Document Center (CSPT) + internal sinks ============ */
const DOC_FETCH_LOG = [];
const WALLET_CREDITS = { d1: 0, d2: 0, d3: 0, d4: 0 };
const ADMIN_ONBOARDING = [
  { id: 'app-901', dealer: 'Skyline Performance Imports', notes: 'Standard onboarding review. Vehicle import docs attached for compliance.', status: 'pending', flag: null }
];
function _walletCredit(dealer, amount) {
  const n = Number(amount) || 0;
  WALLET_CREDITS[dealer] = (WALLET_CREDITS[dealer] || 0) + n;
  return WALLET_CREDITS[dealer];
}
function _internalWebhook(query, req) {
  const p = new URLSearchParams(query || '');
  const action = p.get('action') || 'noop';
  const dealer = p.get('dealer') || 'd1';
  const amount = Number(p.get('amount')) || 0;
  const balance = _walletCredit(dealer, amount);
  const cookie = ((req && req.headers && req.headers.cookie) || '');
  const carried = /(?:^|;\s*)automarket_admin=1(?:;|$)/.test(cookie) ||
    ((req && req.headers && req.headers['x-automarket-admin']) === '1');
  const out = {
    ok: true, action, dealer, amount, new_credit_balance: balance,
    flag: 'LAB{cspt_state_mutation}',
    note: 'internal analytics webhook performed a state change (same-origin dispatch trusted)'
  };
  if (carried) {
    out.auth_carried = true;
    out.auth_flag = 'LAB{cspt_auth_carry}';
    out.note = 'internal webhook inherited the caller session and executed a privileged state change';
  }
  return out;
}
function _internalMetadataFetch(query, res) {
  const p = new URLSearchParams(query || '');
  const url = p.get('url') || '';
  if (!url) return res.status(400).json({ error: 'url required' });
  const hops = [];
  let cur = url;
  let viaRedirect = false;
  const gm = cur.match(/\/go\?(.*)$/);
  if (gm) {
    const to = new URLSearchParams(gm[1]).get('to') || '';
    hops.push({ from: cur, status: 302, location: to, handler: 'storefront open redirect' });
    viaRedirect = true;
    cur = to;
  }
  if (cur.includes('169.254.169.254') || cur.includes('metadata.google.internal')) {
    const out = {
      ok: true, hops, final_url: cur, http_status: 200,
      imds_response: {
        AccessKeyId: 'ASIAIOSFODNN7EXAMPLE',
        SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        Token: 'FQoGZXIvYXdzEXAMPLE...',
        role: 'AutoMarketSyncRole'
      },
      flag: 'LAB{cspt_ssrf_imds}',
      note: 'internal HTTP client followed the redirect into link-local metadata'
    };
    if (viaRedirect) out.chain_flag = 'LAB{cspt_chain_pwned}';
    return res.json(out);
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  fetch(cur, { signal: controller.signal })
    .then(async (r) => {
      clearTimeout(t);
      const body = await r.text().catch(() => '');
      res.json({ ok: true, hops, final_url: cur, http_status: r.status, body_head: body.slice(0, 400) });
    })
    .catch((e) => {
      clearTimeout(t);
      res.json({ ok: false, hops, final_url: cur, error: String(e).slice(0, 200) });
    });
}
function _docCenterDispatch(decoded, req, res) {
  res.set('Cache-Control', 'no-store');
  const parts = String(decoded).split('?');
  const relPath = parts[0] || 'index';
  const rawQuery = parts.slice(1).join('?');
  const resolved = require('path').posix.join('/v1/documents', relPath);
  DOC_FETCH_LOG.push({ raw: decoded, resolved });
  // VULN: internal dispatch trusts anything that resolves under /v1/* and attaches
  // the same-origin marker, so traversed routes reach internal sinks with full context.
  if (resolved === '/v1/internal/analytics-webhook') {
    return res.json({ resolved, internal: true, result: _internalWebhook(rawQuery, req) });
  }
  if (resolved === '/v1/internal/metadata-fetch') {
    return _internalMetadataFetch(rawQuery, res);
  }
  return res.json({ document: resolved.split('/').pop() || 'index', resolved, note: 'dealer document center (public documents only)' });
}
app.get('/v1/documents', (req, res) => {
  // The SPA passes the document path as ?doc= (CSPT: user input flows into the API path).
  if (req.query.doc !== undefined) return _docCenterDispatch(req.query.doc, req, res);
  res.json({ documents: ['Q4-market-report', 'dealer-agreement-template', 'warranty-policy-2026'], fetch_log_tail: DOC_FETCH_LOG.slice(-5) });
});
app.get('/v1/documents/:id', (req, res) => {
  let decoded = req.params.id;
  try { decoded = decodeURIComponent(req.params.id); } catch (e) { /* keep raw */ }
  return _docCenterDispatch(decoded, req, res);
});
app.get('/v1/internal/analytics-webhook', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(403).json({ error: 'internal endpoint: same-origin dispatch only', hint: 'reach it through the document center as the front-end does' });
});
app.get('/v1/internal/metadata-fetch', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(403).json({ error: 'internal endpoint: same-origin dispatch only' });
});
/* ============ Admin onboarding queue (untrusted partner content) ============ */
app.post('/v1/admin/onboarding', (req, res) => {
  const b = req.body || {};
  const app = {
    id: 'app-' + (900 + ADMIN_ONBOARDING.length + 1),
    dealer: String(b.dealer || 'Unknown Dealer'),
    notes: String(b.notes || ''),
    status: 'pending',
    flag: null
  };
  ADMIN_ONBOARDING.push(app);
  res.json({ ok: true, application: app });
});
app.get('/v1/admin/onboarding', (req, res) => {
  res.json({ applications: ADMIN_ONBOARDING.map(a => ({ id: a.id, dealer: a.dealer, status: a.status })) });
});
app.get('/v1/admin/onboarding/:id', (req, res) => {
  const a = ADMIN_ONBOARDING.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'application not found' });
  res.json({ application: a, note: 'raw partner-submitted notes (untrusted external content)' });
});

/* HPP dealer inventory (variant with sort param divergence) */
app.get('/v1/dealers/inventory', (req, res) => {
  const status = req.query.status;
  const isArray = Array.isArray(status);
  const last = isArray ? status[status.length - 1] : status;
  if (last === 'auction_restricted') {
    return res.json({ embargoed: ['embargoed-x1'], flag: 'LAB{hpp_inventory_bypass}' });
  }
  res.json({ inventory: ['a', 'b'] });
});

// ============================================================================
// 1. NEW LAUNCHES & UPCOMING RELEASES
// ============================================================================
const UPCOMING_LAUNCHES = [
  {
    id: 'launch-macan-ev',
    name: 'Porsche Macan EV Turbo',
    brand: 'Porsche',
    launchQuarter: 'Q1 2027',
    tagline: 'Electrified Dynamics. Uncompromised Stuttgart Heritage.',
    basePrice: 105300,
    expectedMSRP: 105300,
    reservationDeposit: 2500,
    productionSlots: 50,
    heroImage: '/launches/porsche-macan-ev.jpg',
    angleFrames: [
      { angle: 0, label: 'Front Fascia 0°', url: '/launches/porsche-macan-ev.jpg' },
      { angle: 45, label: 'Front Right 3/4 45°', url: '/launches/porsche-macan-ev.jpg' },
      { angle: 90, label: 'Side Profile 90°', url: '/vehicles/7-1.jpg' },
      { angle: 135, label: 'Rear Right 3/4 135°', url: '/vehicles/7-2.jpg' },
      { angle: 180, label: 'Rear Tail 180°', url: '/vehicles/7-0.jpg' },
      { angle: 225, label: 'Rear Left 3/4 225°', url: '/vehicles/7-2.jpg' },
      { angle: 270, label: 'Driver Side Profile 270°', url: '/vehicles/7-1.jpg' },
      { angle: 315, label: 'Front Left 3/4 315°', url: '/launches/porsche-macan-ev.jpg' }
    ],
    powertrain: 'Dual Permanent-Magnet Synchronous Motors (800V Architecture)',
    specs: {
      horsepower: '630 hp',
      zeroToSixty: '3.1 sec',
      topSpeed: '161 mph',
      range: '381 miles (WLTP)'
    },
    hp: 630,
    zeroToSixty: '3.1 sec',
    range: '381 miles (WLTP)',
    topSpeed: '161 mph',
    colors: [
      { name: 'Frozen Blue Metallic', hex: '#6ba4b8', type: 'Exclusive Metallic' },
      { name: 'Papaya Metallic', hex: '#e35c2e', type: 'Heritage Gloss' },
      { name: 'Volcano Grey Metallic', hex: '#4a4e51', type: 'Matte Satin' },
      { name: 'Carrara White', hex: '#f0f2f5', type: 'High Gloss' }
    ],
    keyHighlights: [
      '800V Architecture (10% to 80% charge in 21 mins)',
      'Porsche Active Suspension Management (PASM) with 2-Valve Dampers',
      'Augmented Reality Head-Up Display (87" field of view)',
      'Rear-Axle Steering up to 5 degrees',
      'Porsche Electric Sport Sound Telemetry'
    ],
    features: [
      '800V Architecture (10% to 80% charge in 21 mins)',
      'Porsche Active Suspension Management (PASM) with 2-Valve Dampers',
      'Augmented Reality Head-Up Display (87" field of view)',
      'Rear-Axle Steering up to 5 degrees',
      'Porsche Electric Sport Sound Telemetry'
    ],
    spotsRemaining: 18,
    exhaustSample: 'warp_hum_800v',
    hotspots: [
      { id: 'h1', title: 'Aero Matrix LED Optics', detail: 'Active cooling flaps and 4-point daytime running matrix LEDs', desc: 'Active cooling flaps and 4-point daytime running matrix LEDs', x: 22, y: 48 },
      { id: 'h2', title: '22" RS Spyder Forged Wheels', detail: 'Staggered fitment with aeroblades and Porsche Surface Coated Brakes', desc: 'Staggered fitment with aeroblades and Porsche Surface Coated Brakes', x: 42, y: 72 },
      { id: 'h3', title: 'Cockpit Curved OLED Array', detail: '12.6" curved instrument display + 10.9" passenger interactive display', desc: '12.6" curved instrument display + 10.9" passenger interactive display', x: 62, y: 38 },
      { id: 'h4', title: 'Active Rear Aerodynamics', detail: 'Electrically extending rear spoiler with 3 adaptive deployment modes', desc: 'Electrically extending rear spoiler with 3 adaptive deployment modes', x: 86, y: 52 }
    ]
  },
  {
    id: 'launch-neue-klasse',
    name: 'BMW Vision Neue Klasse iX3',
    brand: 'BMW',
    launchQuarter: 'Q2 2027',
    tagline: 'The Re-Invention of the Ultimate Driving Machine.',
    basePrice: 68000,
    expectedMSRP: 68000,
    reservationDeposit: 1500,
    productionSlots: 60,
    heroImage: '/launches/bmw-neue-ix3.jpg',
    angleFrames: [
      { angle: 0, label: 'Front Fascia 0°', url: '/launches/bmw-neue-ix3.jpg' },
      { angle: 45, label: 'Front Right 3/4 45°', url: '/launches/bmw-neue-ix3.jpg' },
      { angle: 90, label: 'Side Profile 90°', url: '/vehicles/21-1.jpg' },
      { angle: 135, label: 'Rear Right 3/4 135°', url: '/vehicles/21-2.jpg' },
      { angle: 180, label: 'Rear Tail 180°', url: '/vehicles/21-0.jpg' },
      { angle: 225, label: 'Rear Left 3/4 225°', url: '/vehicles/21-2.jpg' },
      { angle: 270, label: 'Driver Side Profile 270°', url: '/vehicles/21-1.jpg' },
      { angle: 315, label: 'Front Left 3/4 315°', url: '/launches/bmw-neue-ix3.jpg' }
    ],
    powertrain: 'Sixth-Generation Gen6 BMW eDrive (Cylindrical Cells)',
    specs: {
      horsepower: '510 hp',
      zeroToSixty: '3.8 sec',
      topSpeed: '143 mph',
      range: '460 miles'
    },
    hp: 510,
    zeroToSixty: '3.8 sec',
    range: '460 miles',
    topSpeed: '143 mph',
    colors: [
      { name: 'Joyous Bright Yellow', hex: '#e4cd7c', type: 'Futuristic Metallic' },
      { name: 'Mineral White Pearl', hex: '#f4f4f4', type: 'Multi-Coat Pearl' },
      { name: 'Tanzanite Blue II', hex: '#1b2d4f', type: 'Deep Metallic' },
      { name: 'Isle of Man Green', hex: '#124838', type: 'Motorsport Metallic' }
    ],
    keyHighlights: [
      'BMW Panoramic Vision spanning entire windshield width',
      '30% Faster Charging Speed & 20% Higher Energy Density',
      'Circular Design Philosophy with 100% Recycled Monomaterials',
      'Next-Gen Central Computer with 10x Neural Processing Speed',
      'Phygital Interaction Surfaces integrated into woven textiles'
    ],
    features: [
      'BMW Panoramic Vision spanning entire windshield width',
      '30% Faster Charging Speed & 20% Higher Energy Density',
      'Circular Design Philosophy with 100% Recycled Monomaterials',
      'Next-Gen Central Computer with 10x Neural Processing Speed',
      'Phygital Interaction Surfaces integrated into woven textiles'
    ],
    spotsRemaining: 24,
    exhaustSample: 'hans_zimmer_acoustic_pulse',
    hotspots: [
      { id: 'h1', title: 'Panoramic Vision Windshield', detail: 'Projects driver and driving assistance info across entire base of windshield', desc: 'Projects driver and driving assistance info across entire base of windshield', x: 50, y: 35 },
      { id: 'h2', title: 'Illuminated Digital Kidney Grille', detail: 'Combines lighting, radar, and cameras behind seamless crystal glass', desc: 'Combines lighting, radar, and cameras behind seamless crystal glass', x: 18, y: 55 },
      { id: 'h3', title: 'Aerodynamic Aero-Spoke Rims', detail: 'Optimized directional airflow reducing drag coefficient to 0.22 Cd', desc: 'Optimized directional airflow reducing drag coefficient to 0.22 Cd', x: 38, y: 76 }
    ]
  },
  {
    id: 'launch-ferrari-12c',
    name: 'Ferrari 12Cilindri',
    brand: 'Ferrari',
    launchQuarter: 'Q1 2027',
    tagline: '830 Horsepower of Pure Naturally Aspirated Symphony.',
    basePrice: 423000,
    expectedMSRP: 423000,
    reservationDeposit: 10000,
    productionSlots: 20,
    heroImage: '/launches/ferrari-12c.jpg',
    angleFrames: [
      { angle: 0, label: 'Front Fascia 0°', url: '/launches/ferrari-12c.jpg' },
      { angle: 45, label: 'Front Right 3/4 45°', url: '/launches/ferrari-12c.jpg' },
      { angle: 90, label: 'Side Profile 90°', url: '/vehicles/3-1.jpg' },
      { angle: 135, label: 'Rear Right 3/4 135°', url: '/vehicles/3-2.jpg' },
      { angle: 180, label: 'Rear Tail 180°', url: '/vehicles/3-0.jpg' },
      { angle: 225, label: 'Rear Left 3/4 225°', url: '/vehicles/3-2.jpg' },
      { angle: 270, label: 'Driver Side Profile 270°', url: '/vehicles/3-1.jpg' },
      { angle: 315, label: 'Front Left 3/4 315°', url: '/launches/ferrari-12c.jpg' }
    ],
    powertrain: '6.5-Liter Naturally Aspirated 65° F140HD V12',
    specs: {
      horsepower: '830 hp',
      zeroToSixty: '2.8 sec',
      topSpeed: '217 mph',
      range: '310 miles (Fuel)'
    },
    hp: 830,
    zeroToSixty: '2.8 sec',
    range: '310 miles (Fuel)',
    topSpeed: '217 mph',
    colors: [
      { name: 'Rosso Imola', hex: '#990000', type: 'Historic Rosso' },
      { name: 'Giallo Montecarlo', hex: '#f0b800', type: 'Modena Gold' },
      { name: 'Blu Corsa', hex: '#0055b3', type: 'Vibrant Metallic' },
      { name: 'Nero Daytona', hex: '#1c1c1c', type: 'Deep Diamond' }
    ],
    keyHighlights: [
      '9,500 RPM Redline Naturally Aspirated Maranello Masterpiece',
      'Titanium Connecting Rods (40% lighter than steel)',
      'Side Slip Control (SSC) 8.0 with Four-Wheel Independent Steering',
      'Active Mobile Aerodynamic Flaps activating between 60-300 km/h',
      'Aspirated Torque Shaping in 3rd and 4th gears'
    ],
    features: [
      '9,500 RPM Redline Naturally Aspirated Maranello Masterpiece',
      'Titanium Connecting Rods (40% lighter than steel)',
      'Side Slip Control (SSC) 8.0 with Four-Wheel Independent Steering',
      'Active Mobile Aerodynamic Flaps activating between 60-300 km/h',
      'Aspirated Torque Shaping in 3rd and 4th gears'
    ],
    spotsRemaining: 4,
    exhaustSample: 'ferrari_v12_9500rpm_symphony',
    hotspots: [
      { id: 'h1', title: 'F140HD V12 Powertrain', detail: '6.5L naturally aspirated mid-front mounted 830 HP screamer', desc: '6.5L naturally aspirated mid-front mounted 830 HP screamer', x: 35, y: 46 },
      { id: 'h2', title: 'Aero Flaps & Delta Visor', detail: 'Integrated cockpit glass visor reminiscent of 365 GTB/4 Daytona', desc: 'Integrated cockpit glass visor reminiscent of 365 GTB/4 Daytona', x: 55, y: 38 },
      { id: 'h3', title: 'Carbon Ceramic BmS Brakes', detail: '398mm front discs delivering 100-0 km/h in 31.4 meters', desc: '398mm front discs delivering 100-0 km/h in 31.4 meters', x: 78, y: 68 }
    ]
  },
  {
    id: 'launch-cybercab',
    name: 'Tesla Cybercab Autonomous',
    brand: 'Tesla',
    launchQuarter: 'Q3 2027',
    tagline: 'Autonomous Mobility for Everyone. Zero Steering Wheel.',
    basePrice: 29900,
    expectedMSRP: 29900,
    reservationDeposit: 500,
    productionSlots: 100,
    heroImage: '/launches/tesla-cybercab.jpg',
    angleFrames: [
      { angle: 0, label: 'Front Fascia 0°', url: '/launches/tesla-cybercab.jpg' },
      { angle: 45, label: 'Front Right 3/4 45°', url: '/launches/tesla-cybercab.jpg' },
      { angle: 90, label: 'Side Profile 90°', url: '/vehicles/4-1.jpg' },
      { angle: 135, label: 'Rear Right 3/4 135°', url: '/vehicles/4-2.jpg' },
      { angle: 180, label: 'Rear Tail 180°', url: '/vehicles/4-0.jpg' },
      { angle: 225, label: 'Rear Left 3/4 225°', url: '/vehicles/4-2.jpg' },
      { angle: 270, label: 'Driver Side Profile 270°', url: '/vehicles/4-1.jpg' },
      { angle: 315, label: 'Front Left 3/4 315°', url: '/launches/tesla-cybercab.jpg' }
    ],
    powertrain: 'Single Rear Permanent Magnet Inductive Drive',
    specs: {
      horsepower: '310 hp',
      zeroToSixty: '5.2 sec',
      topSpeed: '110 mph',
      range: '320 miles'
    },
    hp: 310,
    zeroToSixty: '5.2 sec',
    range: '320 miles',
    topSpeed: '110 mph',
    colors: [
      { name: 'Stainless Steel Cyber Gold', hex: '#b5945a', type: 'Brushed Alloy' },
      { name: 'Satin Titanium', hex: '#7a7d84', type: 'Electroplated Matte' },
      { name: 'Obsidian Stealth', hex: '#111214', type: 'PVD Vapor Carbon' }
    ],
    keyHighlights: [
      '100% Unsupervised Full Self-Driving (Hardware 5.0 Vision)',
      'Zero Steering Wheel, Pedals, or Mechanical Controls',
      'Inductive Wireless Resonance High-Speed Charging',
      'Self-Sanitizing UV-C Interior Sterilization Robot',
      'Low Operating Cost under $0.20 per passenger mile'
    ],
    features: [
      '100% Unsupervised Full Self-Driving (Hardware 5.0 Vision)',
      'Zero Steering Wheel, Pedals, or Mechanical Controls',
      'Inductive Wireless Resonance High-Speed Charging',
      'Self-Sanitizing UV-C Interior Sterilization Robot',
      'Low Operating Cost under $0.20 per passenger mile'
    ],
    spotsRemaining: 88,
    exhaustSample: 'ev_futuristic_silent_whirr',
    hotspots: [
      { id: 'h1', title: 'Dihedral Butterfly Doors', detail: 'Automated gullwing doors for seamless curbside boarding', desc: 'Automated gullwing doors for seamless curbside boarding', x: 45, y: 32 },
      { id: 'h2', title: 'Wireless Inductive Floor Plate', detail: 'No charging cable needed; charges over high-efficiency resonant coils', desc: 'No charging cable needed; charges over high-efficiency resonant coils', x: 52, y: 88 },
      { id: 'h3', title: '21" Central Cinema Interface', detail: 'Interactive entertainment screen replacing the traditional dashboard', desc: 'Interactive entertainment screen replacing the traditional dashboard', x: 48, y: 45 }
    ]
  }
];

const LAUNCH_RESERVATIONS = [];

app.get('/v1/launches/upcoming', (req, res) => {
  res.json({ ok: true, count: UPCOMING_LAUNCHES.length, launches: UPCOMING_LAUNCHES });
});

app.post('/v1/launches/reserve', (req, res) => {
  const body = req.body || {};
  const launchId = body.launchId;
  const customerName = body.customerName;
  const email = body.email || body.customerEmail;
  const phone = body.phone || body.customerPhone || 'N/A';
  const preferredColor = body.preferredColor;
  const deliveryCenter = body.deliveryCenter;
  if (!launchId || !customerName || !email) {
    return res.status(400).json({ error: 'launchId, customerName, and email are required' });
  }
  const target = UPCOMING_LAUNCHES.find(l => l.id === launchId) || UPCOMING_LAUNCHES[0];
  const reservationId = 'UVP-RES-' + Math.floor(100000 + Math.random() * 900000);
  const queueNumber = Math.max(1, target.spotsRemaining);
  if (target.spotsRemaining > 1) target.spotsRemaining--;

  const reservation = {
    reservationId,
    launchId: target.id,
    modelName: target.name,
    customerName,
    email,
    phone: phone || 'N/A',
    preferredColor: preferredColor || target.colors[0].name,
    deliveryCenter: deliveryCenter || 'AutoHub Mumbai Flagship',
    depositPaid: target.reservationDeposit,
    queuePriorityNumber: queueNumber,
    status: 'CONFIRMED',
    timestamp: new Date().toISOString()
  };
  LAUNCH_RESERVATIONS.push(reservation);
  res.json({
    ok: true,
    message: `VIP Allocation Confirmed for ${target.name}!`,
    reservation
  });
});

// ============================================================================
// 2. INTERACTIVE 360° INSPECTION STUDIO TELEMETRY
// ============================================================================
app.get('/v1/vehicles/:id/studio-360', (req, res) => {
  const car = vehicles.find(v => v.id === String(req.params.id)) || vehicles[0];
  const angleFrames = [
    { angle: 0, label: 'Front Fascia 0°', frame: car.image || `/vehicles/${car.id}.jpg` },
    { angle: 45, label: 'Front Right 3/4 45°', frame: (car.images && car.images[0]) || `/vehicles/${car.id}-0.jpg` },
    { angle: 90, label: 'Side Profile 90°', frame: (car.images && car.images[1]) || `/vehicles/${car.id}-1.jpg` },
    { angle: 135, label: 'Rear Right 3/4 135°', frame: (car.images && car.images[2]) || `/vehicles/${car.id}-2.jpg` },
    { angle: 180, label: 'Rear Tail 180°', frame: car.image || `/vehicles/${car.id}.jpg` },
    { angle: 225, label: 'Rear Left 3/4 225°', frame: (car.images && car.images[2]) || `/vehicles/${car.id}-2.jpg`, mirror: true },
    { angle: 270, label: 'Driver Side Profile 270°', frame: (car.images && car.images[1]) || `/vehicles/${car.id}-1.jpg`, mirror: true },
    { angle: 315, label: 'Front Left 3/4 315°', frame: (car.images && car.images[0]) || `/vehicles/${car.id}-0.jpg`, mirror: true }
  ];

  const hotspots = [
    { id: 'hs-optics', title: 'Adaptive Matrix Headlamps', status: 'Passed (Grade A+)', x: 24, y: 50, coords: { x: 24, y: 50 }, description: 'Original OEM polycarbonate lens, zero micro-pitting or UV clouding. Lux output 1,480 lm.' },
    { id: 'hs-wheels', title: 'Forged Alloy Rims & Tires', status: 'Passed (Grade A)', x: 44, y: 74, coords: { x: 44, y: 74 }, description: 'Laser runout scan confirms zero curb rash. Michelin Pilot Sport 4S tread depth: 7.2mm.' },
    { id: 'hs-chassis', title: 'Laser Paint Depth Telemetry', status: 'Passed (Original Factory)', x: 58, y: 42, coords: { x: 58, y: 42 }, description: 'Uniform factory thickness: 108–114 µm across all panels. Zero overspray or filler detected.' },
    { id: 'hs-cockpit', title: 'Interior Nappa Leather & HUD', status: 'Passed (Grade A+)', x: 52, y: 34, coords: { x: 52, y: 34 }, description: 'Ozone sanitized cabin, heated seat bolsters immaculate, 0 dead pixels on central display.' },
    { id: 'hs-powertrain', title: 'OBD-II Telemetry & Thermal Scan', status: '0 Fault Codes', x: 78, y: 54, coords: { x: 78, y: 54 }, description: 'ECM diagnostic clear, transmission line pressure optimal, zero oil or coolant weeping.' }
  ];

  const laserPaintDepth = {
    hood: '112 µm',
    roof: '109 µm',
    driverDoor: '114 µm',
    passengerDoor: '111 µm',
    rearQuarter: '113 µm',
    trunkLid: '115 µm'
  };

  const diagnostics = {
    batteryVoltage: '14.2 V (Nominal)',
    batteryHealth: '98.4%',
    brakePadWear: '88% Front / 91% Rear',
    tireTreadDepth: '7.5 mm (Optimal)',
    coolantHealth: 'Optimal (89°C)',
    oilServiceDue: 'In 9,400 miles',
    suspensionAlignmentDelta: '0.02° (Precision Aligned)'
  };

  const studioData = {
    vehicleId: car.id,
    make: car.make,
    model: car.model,
    year: car.year,
    vin: car.vin || 'WP0AB2A99PS123456',
    price: car.price,
    mileage: car.mileage || 18000,
    interiorImage: (car.images && car.images[2]) || `/vehicles/${car.id}-2.jpg`,
    angleFrames,
    hotspots,
    opticalHotspots: hotspots,
    laserPaintDepth,
    paintDepthProfile: laserPaintDepth,
    diagnostics,
    mechanicalDiagnostics: diagnostics,
    timestamp: new Date().toISOString()
  };
  res.json({ ok: true, studio: studioData });
});

// ============================================================================
// 3. CUSTOMER SUPPORT & CONCIERGE HELPDESK
// ============================================================================
const SUPPORT_TICKETS = [
  {
    id: 'TCK-9481',
    customerName: 'Marcus Vance',
    email: 'marcus.vance@autohub.in',
    phone: '+91 98200 11111',
    subject: 'Title Escrow Transfer Request for VIN WP0AB2A99PS123456',
    category: 'Title & Escrow',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedTo: 'Claire Redfield (Title Escrow Director)',
    messages: [
      { sender: 'customer', text: 'Please expedite the digital title transfer certificate for our Mumbai client.', time: '2026-10-18T14:20:00Z' },
      { sender: 'support', text: 'Escrow verification complete. The digitally signed RTO NOC has been dispatched via courier.', time: '2026-10-18T14:45:00Z' }
    ]
  },
  {
    id: 'TCK-9482',
    customerName: 'Emily Watson',
    email: 'emily.watson@gmail.com',
    phone: '+1 (555) 234-5678',
    subject: 'Doorstep Concierge Delivery Time Window Confirmation',
    category: 'Doorstep Delivery',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    assignedTo: 'Vikram Mehta (Concierge Lead)',
    messages: [
      { sender: 'customer', text: 'Can the vehicle handover take place after 5:00 PM tomorrow?', time: '2026-10-18T11:10:00Z' },
      { sender: 'support', text: 'Confirmed! Delivery specialist Arvind has updated your booking for 5:30 PM.', time: '2026-10-18T11:25:00Z' }
    ]
  }
];

const SUPPORT_FAQS = [
  {
    q: 'How does the AutoMarket 200-Point Inspection Guarantee work?',
    a: 'Every vehicle undergoes an exhaustive optical, laser paint-depth, and mechanical scan covering structural integrity, engine compression, transmission pressure, and battery health before receiving our certified seal.'
  },
  {
    q: 'What is the 7-Day / 500-Mile Money-Back Guarantee?',
    a: 'If you are not 100% thrilled with your vehicle, you can return it within 7 calendar days or 500 miles for a complete refund—no questions asked.'
  },
  {
    q: 'Can I trade in a vehicle with an existing loan or lien?',
    a: 'Yes. Our automated trade-in studio coordinates directly with your existing lender to pay off the remaining balance and applies the positive equity toward your new vehicle purchase.'
  },
  {
    q: 'How are doorstep test-drives and deliveries conducted?',
    a: 'A uniformed UVP Concierge specialist transports the vehicle directly to your residence on an enclosed carrier, allowing you to test-drive on your everyday commute routes.'
  },
  {
    q: 'What warranty packages are included with certified inventory?',
    a: 'All vehicles come with a complimentary 12-Month / 15,000-Mile UVP Shield Powertrain Warranty, upgradeable to our Platinum Bumper-to-Bumper Comprehensive Care.'
  }
];

app.get('/v1/support/faq', (req, res) => {
  res.json({ ok: true, count: SUPPORT_FAQS.length, faqs: SUPPORT_FAQS });
});

app.get('/v1/support/tickets', (req, res) => {
  res.json({ ok: true, count: SUPPORT_TICKETS.length, tickets: SUPPORT_TICKETS });
});

app.get('/v1/support/tickets/:id', (req, res) => {
  const ticket = SUPPORT_TICKETS.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ok: true, ticket });
});

app.post('/v1/support/tickets', (req, res) => {
  const body = req.body || {};
  const customerName = body.customerName;
  const email = body.email || body.customerEmail;
  const phone = body.phone || body.customerPhone || 'N/A';
  const subject = body.subject;
  const category = body.category;
  const priority = body.priority;
  const message = body.message;
  const vehicleId = body.vehicleId;
  if (!customerName || !email || !message) {
    return res.status(400).json({ error: 'customerName, email, and message are required' });
  }
  const id = 'TCK-' + Math.floor(1000 + Math.random() * 9000);
  const ticket = {
    id,
    customerName,
    email,
    phone: phone || 'N/A',
    subject: subject || 'General Customer Support Request',
    category: category || 'General Inquiry',
    priority: priority || 'NORMAL',
    status: 'OPEN',
    vehicleId: vehicleId || null,
    assignedTo: 'Alex Chen (Senior Concierge Desk)',
    created: new Date().toISOString(),
    messages: [
      { sender: 'customer', text: message, time: new Date().toISOString() },
      { sender: 'support', text: 'Thank you for reaching out to AutoMarket Concierge. We have assigned a senior liaison to your request. Estimated response time: under 15 minutes.', time: new Date().toISOString() }
    ]
  };
  SUPPORT_TICKETS.unshift(ticket);
  res.json({ ok: true, ticketId: id, message: 'Ticket submitted successfully', ticket });
});

// ============================================================================
// 4. CERTIFIED WARRANTY & PROTECTION SUITE
// ============================================================================
const WARRANTY_PLANS = [
  {
    id: 'plan-platinum',
    name: 'Platinum Elite Care',
    tier: 'Maximum Comprehensive',
    pricePerMonth: 68,
    deductibleOptions: [0, 100, 250],
    coverageMonths: 36,
    coverageMiles: 50000,
    perks: [
      'Comprehensive Bumper-to-Bumper Electrical & Mechanical',
      'High-Voltage EV Battery & Inverter Assembly',
      '24/7 Unlimited Towing & Nationwide Roadside Assistance',
      'Complimentary BMW/Mercedes Loaner Vehicle During Repairs',
      'Key Fob & Windshield Chip Zero-Cost Replacement'
    ],
    recommended: true
  },
  {
    id: 'plan-gold',
    name: 'Gold Powertrain Shield',
    tier: 'Essential Mechanical',
    pricePerMonth: 44,
    deductibleOptions: [100, 250],
    coverageMonths: 24,
    coverageMiles: 30000,
    perks: [
      'Engine Block, Cylinder Heads & Internal Rotating Components',
      'Automatic / PDK Transmission & Torque Converter',
      'Drive Axles, Differential & Transfer Case',
      'Turbocharger / Supercharger Assembly',
      'Emergency Fluid & Fuel Delivery Service'
    ],
    recommended: false
  },
  {
    id: 'plan-silver',
    name: 'Silver Tire & Wheel Armor',
    tier: 'Road Hazard Shield',
    pricePerMonth: 28,
    deductibleOptions: [0, 50],
    coverageMonths: 24,
    coverageMiles: 'Unlimited',
    perks: [
      'Pothole & Road Debris Tire Replacement',
      'Forged & Cast Wheel Cosmetic Rim Curb Rash Repair',
      'Paintless Dent Repair (PDR) for Door Dings',
      'Windshield Crack Resin Repair (up to 6 inches)',
      'Emergency Spare Tire Mounting Assistance'
    ],
    recommended: false
  }
];

app.get('/v1/warranty/plans', (req, res) => {
  res.json({ ok: true, plans: WARRANTY_PLANS });
});

app.post('/v1/warranty/quote', (req, res) => {
  const { make, year, mileage, deductible, planId } = req.body || {};
  const basePlan = WARRANTY_PLANS.find(p => p.id === planId) || WARRANTY_PLANS[0];
  let multiplier = 1.0;
  const yr = Number(year) || 2021;
  const miles = Number(mileage) || 25000;
  if (yr < 2020) multiplier += 0.2;
  if (miles > 40000) multiplier += 0.15;
  if (Number(deductible) === 0) multiplier += 0.15;
  if (Number(deductible) === 250) multiplier -= 0.1;

  const monthlyPrice = Math.round(basePlan.pricePerMonth * multiplier);
  res.json({
    ok: true,
    plan: basePlan.name,
    monthlyPrice,
    annualPrice: monthlyPrice * 12,
    deductible: Number(deductible) || 100,
    vehicleSpecs: { make: make || 'Vehicle', year: yr, mileage: miles },
    coverageSummary: 'Guaranteed repair coverage at 1,400+ certified OEM dealer facilities nationwide.'
  });
});

// ============================================================================
// 5. DEALER ENTERPRISE MICROSERVICES & COMMAND CENTER APIs
// ============================================================================

const DEALER_CRM_LEADS = [
  {
    id: 'LEAD-101',
    customerName: 'Vikram Singhania',
    phone: '+91 98201 44892',
    email: 'v.singhania@singhania-corp.in',
    interestedVehicle: 'Porsche 911 Carrera S (2022)',
    budget: 14500000,
    stage: 'HOT',
    assignedRep: 'Aarav Mehta (Senior Client Director)',
    scheduledTime: 'Today 4:30 PM',
    notes: 'Customer requesting trade-in appraisal on 2020 Cayenne Turbo. Prepared cash cashier check.',
    priority: 'Urgent',
    lastUpdated: '12 mins ago'
  },
  {
    id: 'LEAD-102',
    customerName: 'Ananya Deshmukh',
    phone: '+91 97118 33410',
    email: 'ananya.d@fintech-apex.io',
    interestedVehicle: 'BMW M8 Competition Coupe (2023)',
    budget: 16800000,
    stage: 'TEST_DRIVE_SCHEDULED',
    assignedRep: 'Rohan Kapoor',
    scheduledTime: 'Tomorrow 11:00 AM',
    notes: 'Doorstep concierge test-drive arranged at Bandra Kurla Complex residence.',
    priority: 'High',
    lastUpdated: '45 mins ago'
  },
  {
    id: 'LEAD-103',
    customerName: 'Kabir Oberoi',
    phone: '+91 99304 90211',
    email: 'kabir@oberoi-holdings.com',
    interestedVehicle: 'Aston Martin DBX 707 (2023)',
    budget: 28500000,
    stage: 'NEGOTIATION',
    assignedRep: 'Neha Sharma',
    scheduledTime: 'In Progress',
    notes: 'F&I deal desk reviewing 36-month closed-end balloon lease structure. Credit Tier 1+ verified.',
    priority: 'Urgent',
    lastUpdated: '2 hours ago'
  },
  {
    id: 'LEAD-104',
    customerName: 'Dr. Siddharth Rao',
    phone: '+91 98450 11984',
    email: 's.rao@apollo.med',
    interestedVehicle: 'Mercedes-AMG GT 63 S (2021)',
    budget: 13200000,
    stage: 'FINANCE_APPROVED',
    assignedRep: 'Aarav Mehta',
    scheduledTime: 'Today 6:00 PM',
    notes: 'HDFC Superbike & Luxury Auto loan pre-approved at 7.4% APR. Down payment $35,000 received.',
    priority: 'Normal',
    lastUpdated: '3 hours ago'
  },
  {
    id: 'LEAD-105',
    customerName: 'Meera Sen',
    phone: '+91 98310 77291',
    email: 'meera.sen@designstudio.in',
    interestedVehicle: 'Audi RS e-tron GT (2022)',
    budget: 11900000,
    stage: 'HOT',
    assignedRep: 'Pooja Varma',
    scheduledTime: 'Wednesday 2:00 PM',
    notes: 'Interested in home 22kW wallbox installation bundle and certified battery degradation report.',
    priority: 'High',
    lastUpdated: '5 hours ago'
  },
  {
    id: 'LEAD-106',
    customerName: 'Rajeshwar Mittal',
    phone: '+91 98102 55301',
    email: 'r.mittal@steelgroup.com',
    interestedVehicle: 'Ferrari 296 GTB Assetto Fiorano (2023)',
    budget: 39500000,
    stage: 'DELIVERED',
    assignedRep: 'Aarav Mehta',
    scheduledTime: 'Delivered Yesterday',
    notes: 'Ceramic coat completed. VIP handover ceremony executed in private showroom bay. Deal closed at full sticker.',
    priority: 'Closed',
    lastUpdated: '1 day ago'
  }
];

const FLOORPLAN_DATA = {
  facilityLimit: 5000000,
  drawnAmount: 3420000,
  availableLiquidity: 1580000,
  baseRate: '6.45% SOFR',
  effectiveApr: '7.15% APR',
  monthlyInterestAccrued: 20380,
  lender: 'Bespoke Auto Syndicate & Prime Liquidity Partners',
  curtailmentAlerts: [
    { lotId: 'LOT-504', vehicle: '2021 Mercedes-AMG GT 63 S', daysFloored: 67, curtailmentDue: 9800, deadline: '3 days remaining' },
    { lotId: 'LOT-509', vehicle: '2020 Porsche Taycan Turbo', daysFloored: 62, curtailmentDue: 7500, deadline: '6 days remaining' }
  ],
  fundedLots: [
    { lotId: 'LOT-501', vehicle: '2022 Porsche 911 Carrera S', financed: 112000, daysFloored: 24, dailyInterest: 21.95, status: 'Active' },
    { lotId: 'LOT-502', vehicle: '2023 BMW M8 Competition', financed: 124000, daysFloored: 14, dailyInterest: 24.30, status: 'Active' },
    { lotId: 'LOT-504', vehicle: '2021 Mercedes-AMG GT 63 S', financed: 98000, daysFloored: 67, dailyInterest: 19.20, status: 'Curtailment Due' },
    { lotId: 'LOT-508', vehicle: '2023 Aston Martin DBX 707', financed: 145000, daysFloored: 9, dailyInterest: 28.41, status: 'Active' }
  ]
};

const DISPATCH_SHIPMENTS = [
  {
    id: 'DISP-8801',
    carrier: 'Reliable Enclosed Luxury Transport',
    driver: 'Marcus Vance (+91 99201 10293)',
    truckId: 'CARRIER-RIG-09 (Air-Ride Hydrolift)',
    origin: 'Port of Nhava Sheva, Terminal 3',
    destination: 'Bespoke Auto Hub - South Mumbai Gallery',
    vehicles: ['2024 Porsche 911 Dakar', '2023 Ferrari 296 GTB'],
    status: 'IN_TRANSIT',
    progressPct: 78,
    eta: 'Today, 6:45 PM',
    currentLocation: 'Panvel Expressway Toll (Lat 18.989, Lon 73.117)',
    telematics: { speed: '62 mph', cabinTemp: '20°C Climate Controlled', shockG: '0.08G (Optimal)' }
  },
  {
    id: 'DISP-8802',
    carrier: 'Interstate Premier Auto Haulers',
    driver: 'Devinder Singh (+91 98114 88201)',
    truckId: 'CARRIER-RIG-14 (Custom Enclosed)',
    origin: 'Delhi NCR Logistics Staging Yard',
    destination: 'Bengaluru Tech Corridor Pavilion',
    vehicles: ['2023 BMW M3 CS', '2022 Audi RS6 Avant'],
    status: 'DISPATCHED',
    progressPct: 35,
    eta: 'Tomorrow, 2:30 PM',
    currentLocation: 'NH-48 Golden Quadrilateral',
    telematics: { speed: '55 mph', cabinTemp: '21°C Climate Controlled', shockG: '0.11G (Optimal)' }
  },
  {
    id: 'DISP-8803',
    carrier: 'Silverstone Covered Logistics',
    driver: 'Sunil Patil (+91 97664 32109)',
    truckId: 'CARRIER-RIG-04 (Single-Deck Enclosed)',
    origin: 'Chakan Testing Grounds',
    destination: 'Pune Koregaon Park Gallery',
    vehicles: ['2023 Aston Martin DBX 707'],
    status: 'SCHEDULED',
    progressPct: 0,
    eta: 'Oct 21, 10:00 AM',
    currentLocation: 'Staging Bay 2',
    telematics: { speed: '0 mph', cabinTemp: '19°C Climate Controlled', shockG: '0.00G' }
  }
];

const SERVICE_BAYS = [
  {
    bayId: 'BAY-1',
    name: 'Laser Wheel Alignment & Dynamic Geometry',
    technician: 'Master Tech Arvind',
    vehicle: '2022 Porsche 911 Carrera S (VIN: WP0AB2A92NS240118)',
    job: '4-Wheel Digital Hunter HawkEye Alignment & Corner Balancing',
    status: 'IN_PROGRESS',
    progress: 75,
    estCompletion: '45 mins remaining'
  },
  {
    bayId: 'BAY-2',
    name: 'Ceramic Paint Correction & PPF Cleanroom',
    technician: 'Specialist Gaurav',
    vehicle: '2023 BMW M8 Coupe (VIN: WBSAE0C54NCD19280)',
    job: '9H Graphene Ceramic Coating & Front Clip Self-Healing Clear Bra',
    status: 'IN_PROGRESS',
    progress: 90,
    estCompletion: '20 mins remaining'
  },
  {
    bayId: 'BAY-3',
    name: 'Pre-Delivery Mechanical 200-Point Audit',
    technician: 'Senior Inspector Nilesh',
    vehicle: '2021 Mercedes-AMG GT 63 S (VIN: WDD2906891A049921)',
    job: 'Brake Rotor Micrometer Spec & Hydraulic Fluid Spectrometry',
    status: 'COMPLETED',
    progress: 100,
    estCompletion: 'Passed - Ready for White-Glove Handover'
  },
  {
    bayId: 'BAY-4',
    name: 'EV High-Voltage Battery Diagnostic Lab',
    technician: 'EV Master Tech Priya',
    vehicle: '2022 Audi RS e-tron GT (VIN: WAUR4AF87N9001928)',
    job: 'Module Cell Degradation Scan (State of Health: 98.4%)',
    status: 'IN_PROGRESS',
    progress: 40,
    estCompletion: '1 hr 15 mins remaining'
  },
  {
    bayId: 'BAY-5',
    name: 'Concierge White-Glove Staging & Ozone Sanitization',
    technician: 'Valet Lead Rahul',
    vehicle: '2023 Ferrari 296 GTB (VIN: ZFF98NFA4N0289192)',
    job: 'Semi-Aniline Leather Conditioning & Interior Ozone Treatment',
    status: 'QUEUED',
    progress: 10,
    estCompletion: 'Staged for 5:00 PM Handover'
  },
  {
    bayId: 'BAY-6',
    name: 'Performance Dyno & ECU Health Check',
    technician: 'Calibration Engineer Vikram',
    vehicle: 'Open Staging Slot',
    job: 'Available for Immediate Rapid Assessment',
    status: 'IDLE',
    progress: 0,
    estCompletion: 'Available'
  }
];

// 1. Leads CRM Pipeline
app.get('/v1/dealers/leads/pipeline', (req, res) => {
  const summary = {
    total: DEALER_CRM_LEADS.length,
    hot: DEALER_CRM_LEADS.filter(l => l.stage === 'HOT').length,
    testDriveScheduled: DEALER_CRM_LEADS.filter(l => l.stage === 'TEST_DRIVE_SCHEDULED').length,
    inNegotiation: DEALER_CRM_LEADS.filter(l => l.stage === 'NEGOTIATION').length,
    financeApproved: DEALER_CRM_LEADS.filter(l => l.stage === 'FINANCE_APPROVED').length,
    delivered: DEALER_CRM_LEADS.filter(l => l.stage === 'DELIVERED').length,
    totalPipelineValue: DEALER_CRM_LEADS.reduce((acc, l) => acc + (l.budget || 0), 0)
  };
  res.json({ ok: true, leads: DEALER_CRM_LEADS, summary });
});

app.post('/v1/dealers/leads/update-status', (req, res) => {
  const { leadId, stage, notes, assignedRep } = req.body || {};
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });
  const lead = DEALER_CRM_LEADS.find(l => l.id === leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (stage) lead.stage = stage;
  if (notes) lead.notes = notes;
  if (assignedRep) lead.assignedRep = assignedRep;
  lead.lastUpdated = 'Just now';
  res.json({ ok: true, message: `Lead ${leadId} updated successfully`, lead });
});

app.post('/v1/dealers/leads/create', (req, res) => {
  const { customerName, phone, email, interestedVehicle, budget, notes, priority } = req.body || {};
  if (!customerName || !phone) {
    return res.status(400).json({ error: 'customerName and phone are required' });
  }
  const newLead = {
    id: `LEAD-${Math.floor(100 + Math.random() * 900)}`,
    customerName,
    phone,
    email: email || 'inbound@customer.com',
    interestedVehicle: interestedVehicle || '2023 Porsche 911 Carrera S',
    budget: Number(budget) || 12000000,
    stage: 'HOT',
    assignedRep: 'Aarav Mehta (Senior Client Director)',
    scheduledTime: 'Immediate Callback Required',
    notes: notes || 'New inbound consultation request received via dealer portal.',
    priority: priority || 'High',
    lastUpdated: 'Just now'
  };
  DEALER_CRM_LEADS.unshift(newLead);
  res.json({ ok: true, message: 'New customer lead logged into CRM', lead: newLead });
});

// 2. Floorplan Liquidity Facility
app.get('/v1/dealers/floorplan/facility', (req, res) => {
  res.json({ ok: true, facility: FLOORPLAN_DATA });
});

app.post('/v1/dealers/floorplan/draw', (req, res) => {
  const { vehicle, amount, lotId } = req.body || {};
  const drawAmt = Number(amount);
  if (!drawAmt || drawAmt <= 0) return res.status(400).json({ error: 'Valid draw amount is required' });
  if (drawAmt > FLOORPLAN_DATA.availableLiquidity) {
    return res.status(400).json({ error: 'Draw amount exceeds available floorplan facility liquidity' });
  }
  FLOORPLAN_DATA.drawnAmount += drawAmt;
  FLOORPLAN_DATA.availableLiquidity -= drawAmt;
  const newLot = {
    lotId: lotId || `LOT-${Math.floor(510 + Math.random() * 90)}`,
    vehicle: vehicle || 'Newly Acquired Wholesale Unit',
    financed: drawAmt,
    daysFloored: 1,
    dailyInterest: Math.round((drawAmt * 0.0715 / 365) * 100) / 100,
    status: 'Active'
  };
  FLOORPLAN_DATA.fundedLots.unshift(newLot);
  res.json({
    ok: true,
    message: `Floorplan advance of $${drawAmt.toLocaleString()} disbursed to dealer clearing account.`,
    drawnAmount: FLOORPLAN_DATA.drawnAmount,
    availableLiquidity: FLOORPLAN_DATA.availableLiquidity,
    fundedLot: newLot
  });
});

app.post('/v1/dealers/floorplan/payoff', (req, res) => {
  const { lotId, amount } = req.body || {};
  const payoffAmt = Number(amount) || 0;
  const lotIdx = FLOORPLAN_DATA.fundedLots.findIndex(l => l.lotId === lotId);
  if (lotIdx !== -1) {
    const lot = FLOORPLAN_DATA.fundedLots[lotIdx];
    const deduct = payoffAmt > 0 ? payoffAmt : lot.financed;
    FLOORPLAN_DATA.drawnAmount = Math.max(0, FLOORPLAN_DATA.drawnAmount - deduct);
    FLOORPLAN_DATA.availableLiquidity = Math.min(FLOORPLAN_DATA.facilityLimit, FLOORPLAN_DATA.availableLiquidity + deduct);
    FLOORPLAN_DATA.fundedLots.splice(lotIdx, 1);
    return res.json({
      ok: true,
      message: `Lot ${lotId} successfully settled and released from floorplan lien.`,
      drawnAmount: FLOORPLAN_DATA.drawnAmount,
      availableLiquidity: FLOORPLAN_DATA.availableLiquidity
    });
  }
  res.status(404).json({ error: 'Funded lot not found' });
});

// 3. Carrier Dispatch & Logistics
app.get('/v1/dealers/dispatch/shipments', (req, res) => {
  res.json({ ok: true, shipments: DISPATCH_SHIPMENTS });
});

app.post('/v1/dealers/dispatch/schedule', (req, res) => {
  const { carrier, origin, destination, vehicle, carrierType } = req.body || {};
  if (!carrier || !destination || !vehicle) {
    return res.status(400).json({ error: 'carrier, destination, and vehicle are required' });
  }
  const newDispatch = {
    id: `DISP-${Math.floor(8810 + Math.random() * 90)}`,
    carrier,
    driver: 'Carrier Dispatch Liaison (+91 98200 99182)',
    truckId: carrierType === 'enclosed' ? 'CARRIER-RIG-08 (Hydraulic Enclosed)' : 'CARRIER-RIG-22 (Multi-Car Open)',
    origin: origin || 'Central Logistics Hub',
    destination,
    vehicles: [vehicle],
    status: 'SCHEDULED',
    progressPct: 5,
    eta: 'Tomorrow, 5:00 PM',
    currentLocation: 'Staging Depot Gate 4',
    telematics: { speed: '0 mph', cabinTemp: '20°C Climate Controlled', shockG: '0.00G' }
  };
  DISPATCH_SHIPMENTS.unshift(newDispatch);
  res.json({ ok: true, message: 'Carrier transport scheduled with GPS telematics beacon', shipment: newDispatch });
});

app.post('/v1/dealers/dispatch/telematics-ping', (req, res) => {
  const { dispatchId } = req.body || {};
  const shipment = DISPATCH_SHIPMENTS.find(s => s.id === dispatchId) || DISPATCH_SHIPMENTS[0];
  if (shipment) {
    shipment.progressPct = Math.min(100, shipment.progressPct + 10);
    if (shipment.progressPct >= 100) {
      shipment.status = 'DELIVERED';
      shipment.eta = 'Delivered & Condition Bill-of-Lading Signed';
    }
  }
  res.json({ ok: true, shipment });
});

// 4. Service Bay & Multi-Point Inspection Dispatch
app.get('/v1/dealers/service/bay-status', (req, res) => {
  res.json({ ok: true, bays: SERVICE_BAYS });
});

app.post('/v1/dealers/service/schedule-job', (req, res) => {
  const { bayId, vehicle, job, technician } = req.body || {};
  const bay = SERVICE_BAYS.find(b => b.bayId === bayId);
  if (!bay) return res.status(404).json({ error: 'Bay not found' });
  bay.vehicle = vehicle || 'Assigned Vehicle';
  bay.job = job || 'Multi-Point Inspection & Fluid Service';
  if (technician) bay.technician = technician;
  bay.status = 'IN_PROGRESS';
  bay.progress = 20;
  bay.estCompletion = '1 hr 30 mins remaining';
  res.json({ ok: true, message: `Work order dispatched to ${bay.name}`, bay });
});

// 5. Real-Time Deal Desk Calculator (F&I Desk)
app.post('/v1/dealers/deal-desk/calculate', (req, res) => {
  const {
    sellingPrice = 120000,
    dealerInvoiceCost = 108000,
    downPayment = 20000,
    tradeInAllowance = 0,
    tradeInPayoff = 0,
    termMonths = 60,
    customerApr = 6.99,
    dealerBuyRate = 5.49,
    products = {}
  } = req.body || {};

  const netTrade = Math.max(0, Number(tradeInAllowance) - Number(tradeInPayoff));
  const frontEndGross = Math.max(0, Number(sellingPrice) - Number(dealerInvoiceCost));

  // Back-end products
  let backendGross = 0;
  let backendProductsCost = 0;
  if (products.extendedWarranty) {
    backendGross += 1400; // Dealer profit margin
    backendProductsCost += 2800; // Retail cost to buyer
  }
  if (products.gapInsurance) {
    backendGross += 650;
    backendProductsCost += 995;
  }
  if (products.ceramicProtection) {
    backendGross += 850;
    backendProductsCost += 1295;
  }
  if (products.tireAndWheel) {
    backendGross += 600;
    backendProductsCost += 1100;
  }

  // Amount financed
  const amountFinanced = Math.max(0, Number(sellingPrice) + backendProductsCost - Number(downPayment) - netTrade);

  // Rate markup profit (dealer reserve = difference between customer APR and buy rate)
  const rateSpread = Math.max(0, Number(customerApr) - Number(dealerBuyRate));
  const financeReserve = Math.round((amountFinanced * (rateSpread / 100) * (Number(termMonths) / 12)) * 0.75);
  const totalBackendProfit = backendGross + financeReserve;
  const totalGPU = frontEndGross + totalBackendProfit;

  // Monthly payment calculation
  const monthlyRate = (Number(customerApr) / 100) / 12;
  let monthlyPayment = 0;
  if (monthlyRate > 0 && amountFinanced > 0) {
    monthlyPayment = Math.round(
      amountFinanced * (monthlyRate * Math.pow(1 + monthlyRate, Number(termMonths))) /
      (Math.pow(1 + monthlyRate, Number(termMonths)) - 1)
    );
  }

  res.json({
    ok: true,
    amountFinanced,
    monthlyPayment,
    frontEndGross,
    financeReserve,
    backendProductsGross: backendGross,
    totalGPU,
    dealScore: totalGPU > 5000 ? 'Exceptional Margin (5★)' : 'Strong Performance (4★)',
    approvalToken: `FNI-DEAL-${Date.now().toString(36).toUpperCase()}`
  });
});

// 6. Dealer Operational Analytics & Performance
app.get('/v1/dealers/analytics/performance', (req, res) => {
  res.json({
    ok: true,
    kpis: {
      avgGPU: 4850,
      avgDaysToTurn: 18.4,
      leadConversionRate: '16.8%',
      inventoryTurnover: '19.8x',
      customerCsat: '4.92 / 5.0'
    },
    monthlyDelivered: 42,
    monthlyTarget: 50,
    projectedNetProfit: 218500,
    revenueMix: [
      { category: 'Pre-Owned Retail Sales', amount: 4280000, percentage: 68 },
      { category: 'F&I Deal Desk Margin', amount: 342000, percentage: 12 },
      { category: 'Service & Reconditioning', amount: 185000, percentage: 8 },
      { category: 'Wholesale B2B Auction', amount: 490000, percentage: 12 }
    ]
  });
});

// 7. Dealership Franchise / Partner Application
app.post('/v1/dealers/partners/apply', (req, res) => {
  const { dealershipName, primaryContact, email, phone, city, showroomSqFt, annualVolume, brandsRepresented } = req.body || {};
  if (!dealershipName || !primaryContact || !phone) {
    return res.status(400).json({ error: 'dealershipName, primaryContact, and phone are required' });
  }
  res.json({
    ok: true,
    applicationId: `PARTNER-APP-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'PRE_APPROVED_TIER_1',
    message: 'Dealership franchise accreditation application submitted successfully. Executive liaison assigned.',
    expeditedApproval: true,
    dealershipName,
    city: city || 'Mumbai',
    assignedLiaison: 'Director of Dealer Relations: Vikram Rathore (+91 22 8849 0011)'
  });
});


