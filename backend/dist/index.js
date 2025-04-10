"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const morgan_1 = __importDefault(require("morgan"));
const laundry_service_1 = require("./services/laundry/laundry.service");
const stripe_provider_1 = require("./payments/stripe.provider");
// Debug logging
console.log('Starting server with debug info:');
console.log('Current directory:', __dirname);
console.log('Process directory:', process.cwd());
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'https://yourchore.com', 'https://yourchorecom-production.up.railway.app'],
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});
// Debug middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
    console.log('Body:', req.body);
    next();
});
// Root health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'YourChore API is running',
        env: process.env.NODE_ENV,
        cwd: process.cwd(),
        dirname: __dirname,
        node_version: process.version,
        timestamp: new Date().toISOString()
    });
});
// Service registry
const services = {};
const vendors = {};
const paymentProviders = {};
// Initialize services
function initializeServices() {
    console.log('Initializing services...');
    const stripeProvider = new stripe_provider_1.StripePaymentProvider({
        secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    });
    vendors['angie'] = {
        id: 'angie',
        name: "Angie's Laundry",
        description: 'Professional laundry service',
        isActive: true,
        services: ['laundry'],
        royaltyRate: 0.15,
        paymentMethods: ['stripe'],
        config: {}
    };
    const laundryService = new laundry_service_1.LaundryService({
        service: {
            id: 'laundry',
            name: 'Laundry Service',
            description: 'Professional laundry service',
            isActive: true,
            basePrice: 15,
            config: {}
        },
        vendor: vendors['angie'],
        paymentProvider: stripeProvider
    });
    services['laundry'] = laundryService;
    paymentProviders['stripe'] = stripeProvider;
    console.log('Services initialized:', Object.keys(services));
    console.log('Vendors initialized:', Object.keys(vendors));
}
// Initialize services before setting up routes
initializeServices();
// API Routes
app.get('/api/services', (req, res) => {
    console.log('GET /api/services - Available services:', Object.keys(services));
    try {
        const availableServices = Object.values(services)
            .map(service => service.getServiceInfo())
            .filter(service => service.isActive);
        console.log('Sending services:', availableServices);
        res.json(availableServices);
    }
    catch (error) {
        console.error('Error in /api/services:', error);
        res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/vendors', (req, res) => {
    console.log('GET /api/vendors - Available vendors:', Object.keys(vendors));
    try {
        const availableVendors = Object.values(vendors)
            .filter(vendor => vendor.isActive);
        res.json(availableVendors);
    }
    catch (error) {
        console.error('Error in /api/vendors:', error);
        res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.post('/api/orders', async (req, res) => {
    console.log('POST /api/orders - Creating order:', req.body);
    try {
        const { serviceId, paymentMethodId, ...orderData } = req.body;
        const service = services[serviceId];
        if (!service) {
            console.log('Service not found:', serviceId);
            return res.status(404).json({ error: 'Service not found' });
        }
        const order = await service.createOrder({
            ...orderData,
            paymentMethodId
        });
        console.log('Order created:', order.id);
        res.json(order);
    }
    catch (error) {
        console.error('Order creation failed:', error);
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: Object.keys(services),
        vendors: Object.keys(vendors)
    });
});
// Serve static frontend files AFTER API routes
app.use(express_1.default.static(path_1.default.join(__dirname, '../../frontend/dist')));
// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../frontend/dist/index.html'));
});
// Initialize and start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Static files path: ${path_1.default.join(__dirname, '../../frontend/dist')}`);
});
// Handle server errors
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }
    switch (error.code) {
        case 'EACCES':
            console.error(`Port ${PORT} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`Port ${PORT} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});
