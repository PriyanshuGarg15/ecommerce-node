const asyncErrorHandler = require('../middleware/ErrorHandler');
const Order = require('../models/order');
const Product = require('../models/product');
const ErrorHandler = require('../utils/SyncErrorHandler');
const sendEmail = require('../utils/sendEmails');


module.exports = {

    //Place new Order
    newOrder: asyncErrorHandler(async (req, res, next) => {
        const {
            shippingInfo,
            orderItems,
            paymentInfo,
            totalPrice,
        } = req.body;
        const orderExist = await Order.findOne({ paymentInfo });

        if (orderExist) {
            return next(new ErrorHandler("Order Already Placed", 400));
        }

        const order = await Order.create({
            shippingInfo,
            orderItems,
            paymentInfo,
            totalPrice,
            paidAt: Date.now(),
            user: req.user._id,
        });

        await sendEmail({
            email: req.user.email,
            templateId: process.env.SENDGRID_ORDER_TEMPLATEID,
            data: {
                name: req.user.name,
                shippingInfo,
                orderItems,
                totalPrice,
                oid: order._id,
            }
        });

        res.status(201).json({
            success: true,
            order,
        });
    }),

    //Get single Order Detail
    getSingleOrderDetails: asyncErrorHandler(async (req, res, next) => {

        const order = await Order.findById(req.params.id).populate("user", "name email");

        if (!order) {
            return next(new ErrorHandler("Order Not Found", 404));
        }

        res.status(200).json({
            success: true,
            order,
        });
    }),

    //Get my order 
    myOrders: asyncErrorHandler(async (req, res, next) => {

        const orders = await Order.find({ user: req.user._id });

        if (!orders) {
            return next(new ErrorHandler("Order Not Found", 404));
        }

        res.status(200).json({
            success: true,
            orders,
        });
    }),


    //ADMIN ALL ORDERS
    getAllOrders: asyncErrorHandler(async (req, res, next) => {

        const orders = await Order.find();

        if (!orders) {
            return next(new ErrorHandler("Order Not Found", 404));
        }

        let totalAmount = 0;
        orders.forEach((order) => {
            totalAmount += order.totalPrice;
        });

        res.status(200).json({
            success: true,
            orders,
            totalAmount,
        });
    }),

    //ADMIN UPDATE ORDER


    // Update Order Status ---ADMIN
    updateOrder: asyncErrorHandler(async (req, res, next) => {

        const order = await Order.findById(req.params.id);

        if (!order) {
            return next(new ErrorHandler("Order Not Found", 404));
        }

        if (order.orderStatus === "Delivered") {
            return next(new ErrorHandler("Already Delivered", 400));
        }

        if (req.body.status === "Shipped") {
            order.shippedAt = Date.now();
            order.orderItems.forEach(async (i) => {
                await updateStock(i.product, i.quantity)
            });
        }

        order.orderStatus = req.body.status;
        if (req.body.status === "Delivered") {
            order.deliveredAt = Date.now();
        }

        await order.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true
        });
    }),

    //DELETE ORDER -ADMIN
    deleteOrder: asyncErrorHandler(async (req, res, next) => {

        const order = await Order.findById(req.params.id);
        if (!order) {
            return next(new ErrorHandler("Order Not Found", 404));
        }

        await order.deleteOrder();
        res.status(200).json({
            success: true,
        });
    })
}


const updateStock= async(id, quantity)=> {
    const product = await Product.findById(id);
    product.stock -= quantity;
    await product.save({ validateBeforeSave: false });
}
