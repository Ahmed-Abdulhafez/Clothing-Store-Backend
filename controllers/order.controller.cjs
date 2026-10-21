const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const orderModel = require("../models/order.schema.cjs");
const cartModel = require("../models/cart.schema.cjs");
const productModel = require("../models/product.schema.cjs");


// Get All Orders (Admin Only)
exports.getAllOrder = async (req, res) => {
  try {
    const orders = await orderModel
      .find()
      .populate("user", "username email") // لجلب اسم وإيميل العميل
      .populate("cartItems.product", "title name price images"); // لجلب تفاصيل المنتجات داخل الطلب

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: orders,
    });
  } catch (error) {
    console.error("GET ALL ORDERS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Orders
exports.getUserOrders = async (req, res) => {
  try {
    const userOrders = await orderModel.find({ user: req.user._id }).populate({
      path: "cartItems.product", // 👈 تم التصحيح من book إلى product
      select: "title name price images", // حددنا الحقول المطلوبة
    });

    if (!userOrders || userOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this user!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      results: userOrders.length,
      data: userOrders,
    });
  } catch (error) {
    console.log("Error getting user orders:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get Specific Order By ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const orderById = await orderModel.findById(id).populate({
      path: "cartItems.product",
      select: "title name price images",
    });

    if (!orderById) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    // 💡 استخراج الـ ID للتعامل معه بأمان سواء كان ObjectId أو كائن تم عمل populate له
    const orderUserId = orderById.user?._id
      ? orderById.user._id.toString()
      : orderById.user?.toString();
    const currentUserId = req.user._id.toString();

    if (orderUserId !== currentUserId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this order!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: orderById,
    });
  } catch (error) {
    console.log("Error getting order by id:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Create New Order
exports.createNewOrder = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { shippingAddress } = req.body;

    const cart = await cartModel.findById(cartId);

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found!" });
    }

    // التأكد من أن السلة تحتوي على منتجات
    if (!cart.cartItems || cart.cartItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Cart is empty!" });
    }

    // 2. إنشاء الطلب الجديد
    const newOrder = await orderModel.create({
      user: req.user._id,
      cartItems: cart.cartItems,
      shippingAddress: shippingAddress,
      totalOrderPrice: cart.totalCartPrice,
      paymentMethodType: "cash", // يمكن جعلها ديناميكية إذا أردت دعم الدفع الإلكتروني لاحقاً
    });

    if (newOrder) {
      // 3. حذف السلة بعد إتمام الطلب بنجاح
      await cartModel.findByIdAndDelete(cartId);

      // 4. (مهم جداً) خصم الكمية المباعة من مخزون المنتجات
      for (const item of cart.cartItems) {
        await productModel.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }, // تقليص المخزون بالكمية المطلوبة
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    console.log("Error creating order:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update Order to Paid
exports.updateOrderToPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await orderModel.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    order.isPaid = true;
    order.paidAt = Date.now();

    const updatedOrder = await order.save();

    return res.status(200).json({
      success: true,
      message: "Order payment status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.log("Error updating payment status:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update Order to Delivered
exports.updateOrderToDelivered = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await orderModel.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found!" });
    }

    order.isDelivered = true;
    order.deliveredAt = Date.now();

    const updatedOrder = await order.save();

    return res.status(200).json({
      success: true,
      message: "Order delivery status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.log("Error updating delivery status:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Stripe Checkout
exports.createCheckoutSession = async (req, res) => {
  try {
    const { cartId } = req.params;

    const cart = await cartModel.findById(cartId).populate("cartItems.product");
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found!" });
    }

    const totalOrderPrice = cart.totalCartPrice;

    // تحويل عناصر السلة لـ Stripe Line Items ( لكي يرى العميل المنتجات في صفحة الدفع)
    const lineItems = cart.cartItems.map((item) => ({
      price_data: {
        currency: "egp",
        product_data: {
          name: item.product?.title || item.product?.name || "Product",
          images: item.product?.images?.[0]?.url
            ? [item.product.images[0].url]
            : [],
        },
        unit_amount: item.price * 100, // السعر بالقرش
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: req.user.email,
      client_reference_id: cartId,

      metadata: {
        shippingAddress: JSON.stringify(req.body.shippingAddress),
      },

      line_items: lineItems, // استخدام المنتجات الحقيقية

      success_url: "http://localhost:5173/payment-success",
      cancel_url: "http://localhost:5173/cart",
    });

    return res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      data: session,
    });
  } catch (error) {
    console.log("Error creating checkout session:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// webhook Checkout Stripe
exports.webhookCheckout = async (req, res) => {
  const stripeSignature = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      stripeSignature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.log(`⚠️ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // 🛡️ التحقق لمنع تكرار الطلب
    const existingOrder = await orderModel.findOne({
      "paymentResult.id": session.id,
    });
    if (existingOrder) {
      return res.status(200).json({ received: true });
    }

    const cartId = session.client_reference_id;
    const shippingAddress = JSON.parse(session.metadata.shippingAddress);

    try {
      // جلب السلة فقط
      const cart = await cartModel.findById(cartId);

      if (cart) {
        // إنشاء الأوردر واستخدام cart.user مباشرة
        const newOrder = await orderModel.create({
          user: cart.user, 
          cartItems: cart.cartItems,
          shippingAddress: shippingAddress,
          totalOrderPrice: cart.totalCartPrice,
          paymentMethodType: "card",
          isPaid: true,
          paidAt: Date.now(),
          paymentResult: {
            id: session.id,
            status: session.payment_status,
            email_address: session.customer_email,
          },
        });

        if (newOrder) {
          // تحديث المخزون
          const bulkOptions = cart.cartItems.map((item) => ({
            updateOne: {
              filter: { _id: item.product },
              update: {
                $inc: { stock: -item.quantity, sold: +item.quantity },
              },
            },
          }));
          await productModel.bulkWrite(bulkOptions);

          // مسح السلة
          await cartModel.findByIdAndDelete(cartId);
        }
      }
    } catch (error) {
      console.log("Error processing webhook order:", error);
    }
  }

  res.status(200).json({ received: true });
};
