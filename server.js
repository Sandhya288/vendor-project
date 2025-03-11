// using express JS
var express = require("express");
var app = express();
const mongoose = require('mongoose');
const path = require("path");
const fs = require("fs");
const multer = require('multer');




// Improvedvar formidable = require("express-formidable");
var formidable = require("express-formidable");
app.use(formidable());

// use mongo DB as database
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;

// the unique ID for each mongo DB document
var ObjectId = mongodb.ObjectId;

// receiving http requests
var httpObj = require("http");
var http = httpObj.createServer(app);

// to encrypt/decrypt passwords
var bcrypt = require("bcrypt");

// to store files
var fileSystem = require("fs");


// to start the session
var session = require("express-session");
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false
}));

// define the publically accessible folders
app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/img", express.static(__dirname + "/public/img"));
app.use("/public/font-awesome-4.7.0", express.static(__dirname + "/public/font-awesome-4.7.0"));
app.use("/public/fonts", express.static(__dirname + "/public/fonts"));
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use("/generated-websites", express.static(path.join(__dirname, "generated-websites")));
app.use("/upload", express.static(path.join(__dirname, "public/upload")));


// using EJS as templating engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// main URL of website
var mainURL = "http://localhost:3000";

// global database object
var database = null;

// app middleware to attach main URL and user object with each request
app.use(function(request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    // continue the request
    next();
});

// recursive function to get the file from uploaded
function recursiveGetFile(files, _id) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        // return if file type is not folder and ID is found
        if (file.type != "folder") {
            if (file._id == _id) {
                return file;
            }
        }


    }
}

// function to add new uploaded object and return the updated array
function getUpdatedArray(arr, _id, uploadedObj) {
    for (var a = 0; a < arr.length; a++) {
        // push in files array if type is folder and ID is found
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                arr[a].files.push(uploadedObj);
                arr[a]._id = ObjectId(arr[a]._id);
            }

            // if it has files, then do the recursion
            if (arr[a].files.length > 0) {
                arr[a]._id = ObjectId(arr[a]._id);
                getUpdatedArray(arr[a].files, _id, uploadedObj);
            }
        }
    }

    return arr;
}

// recursive function to remove the file and return the updated array
function removeFileReturnUpdated(arr, _id) {
    for (var a = 0; a < arr.length; a++) {
        if (arr[a].type != "folder" && arr[a]._id == _id) {
            // remove the file from uploads folder
            try {
                fileSystem.unlinkSync(arr[a].filePath);
            } catch (exp) {
                // 
            }
            // remove the file from array
            arr.splice(a, 1);
            break;
        }

        // do the recursion if it has sub-folders
        if (arr[a].type == "folder" && arr[a].files.length > 0) {
            arr[a]._id = ObjectId(arr[a]._id);
            removeFileReturnUpdated(arr[a].files, _id);
        }
    }

    return arr;
}

// recursive function to search uploaded files
function recursiveSearch(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        if (file.type == "folder") {
            // search folder case-insensitive
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearch(file.files, query);
                if (singleFile != null) {
                    // need parent folder in case of files
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}


// recursive function to search shared files
function recursiveSearchShared(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        var file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

        if (file.type == "folder") {
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearchShared(file.files, query);
                if (singleFile != null) {
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}

// start the http server
http.listen(3000, function() {
    const cors = require("cors");
    const bodyParser = require("body-parser");
    app.use(cors());
    app.use(bodyParser.json());
    console.log("Server started at " + mainURL);

    // connect with mongo DB server
    mongoClient.connect("mongodb+srv://sandhyarameshnaik12:UrK6iexZ8hGpQ6wD@cluster0.wu4bo.mongodb.net", {
        useUnifiedTopology: true
    }, function(error, client) {

        // connect database (it will automatically create the database if not exists)
        database = client.db("file_transfer");
        console.log("Database connected.");

        const mongoose = require('mongoose');
        const Schema = mongoose.Schema;

        // Billing Schema
        const billingSchema = new Schema({
            invoiceNumberc: {
                type: String,
                required: true,
                unique: true // Ensures invoice number is unique
            },
            customerName: {
                type: String,
                required: true
            },
            customerEmail: {
                type: String,
                required: true,
                match: /.+\@.+\..+/ // Ensures valid email format
            },
            items: {
                type: [String], // Array of item names
                required: true
            },
            quantity: {
                type: [Number], // Array of quantities for each item
                required: true
            },
            price: {
                type: [Number], // Array of prices for each item
                required: true
            },
            total: {
                type: Number,
                required: true
            }
        }, {
            timestamps: true // Adds createdAt and updatedAt fields
        });

        // Create model based on the schema
        const Billing = mongoose.model('Bill', billingSchema);

        module.exports = Billing;



        app.post('/api/billing', async(req, res) => {
            try {
                const { invoiceNumber, customerName, customerEmail, items, quantity, price, total } = req.body;

                // Split items, quantity, and price into arrays
                const itemsArray = items.split(',').map(item => item.trim()); // Trim any extra spaces
                const quantityArray = quantity.split(',').map(qty => parseInt(qty.trim())); // Convert to integers
                const priceArray = price.split(',').map(pr => parseFloat(pr.trim())); // Convert to floats

                // Ensure the arrays have the same length
                if (itemsArray.length !== quantityArray.length || itemsArray.length !== priceArray.length) {
                    return res.status(400).json({ message: 'Items, quantity, and price arrays must have the same length.' });
                }

                // Calculate the total if necessary (this should match the client-side calculation logic)
                const calculatedTotal = quantityArray.reduce((acc, qty, index) => acc + qty * priceArray[index], 0);

                // Create new billing document
                const newBilling = new Billing({
                    invoiceNumber,
                    customerName,
                    customerEmail,
                    items: itemsArray,
                    quantity: quantityArray,
                    price: priceArray,
                    total: calculatedTotal // Use the calculated total
                });

                // Save the billing data to MongoDB
                await newBilling.save();

                res.status(200).json({ message: 'Billing data saved successfully!' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Error saving billing data', error });
            }
        });

        app.get('/api/billing', (req, res) => {
            // Render the billing page using EJS (or render it as needed)
            res.render('billing', {
                title: 'Billing',
                mainURL: req.protocol + '://' + req.get('host'), // Pass the base URL to the template
                isLogin: req.session.isLogin,
                user: req.session.user,
            });
        });

        app.get("/pro-versions", function(request, result) {
            result.render("proVersions", {
                "request": request
            });
        });

        app.get("/Admin", async function(request, result) {
            // render an HTML page with number of pages, and posts data
            result.render("Admin", {
                request: request
            });
        });


        const uploadDir = 'public/upload/products';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const productStorage = multer.diskStorage({
            destination: function(req, file, cb) {
                cb(null, uploadDir); // Save in the `products` subfolder
            },
            filename: function(req, file, cb) {
                cb(null, Date.now() + '-' + file.originalname); // Add timestamp to avoid filename conflicts
            },
        });

        const uploadProductImage = multer({
            storage: productStorage,
            limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
            fileFilter: (req, file, cb) => {
                const fileTypes = /jpeg|jpg|png/;
                const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
                const mimetype = fileTypes.test(file.mimetype);

                if (mimetype && extname) {
                    cb(null, true);
                } else {
                    cb(new Error('Only images (JPEG, JPG, PNG) are allowed!'));
                }
            },
        });

        app.post("/product", async function(request, result) {
            try {
                // Retrieve form fields
                var name = request.fields.name;
                var description = request.fields.description;
                var price = request.fields.price;


                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("product", {
                        request: request,
                        product: [],
                    });
                }

                // Validate required fields
                if (!name ||
                    !description ||
                    !price

                ) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const product = await database
                        .collection("product")
                        .find({
                            userId: request.session.user._id,
                        })
                        .toArray(); // Fetch existing payments
                    return result.render("product", {
                        request: request,
                        product: product,
                    });
                }

                // Insert payment data into the database
                await database.collection("product").insertOne({
                    userId: request.session.user._id, // Use the logged-in user's ID
                    name: name,
                    description: description,
                    price: price,

                    createdAt: new Date(), // Add a timestamp
                });

                // Fetch updated payment list in descending order by creation date
                const product = await database
                    .collection("product")
                    .find({
                        userId: request.session.user._id,
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "Product submitted successfully.";
                result.render("product", {
                    request: request,
                    product: product, // Pass the updated payment list
                });
            } catch (error) {
                console.error("Error processing payment:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const product = await database
                    .collection("product")
                    .find({
                        userId: request.session.user._id,
                    })
                    .toArray(); // Fetch existing payments
                result.render("product", { request: request, product: product });
            }
        });


        app.get("/product", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("product", {
                        request: request,
                        product: [],
                    });
                }

                // Retrieve payments for the logged-in user in descending order by creation date
                const product = await database
                    .collection("product")
                    .find({
                        userId: request.session.user._id, // Use the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Payment page with the payment list
                request.status = "success";
                request.message = "Product fetched successfully.";
                result.render("product", {
                    request: request,
                    product: product, // Ensure `payments` is passed to the EJS template
                });
            } catch (error) {
                console.error("Error fetching product:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("product", { request: request, product: [] });
            }
        });

        app.post("/product/update", async function(request, result) {
            try {
                // Retrieve form fields
                const productId = request.fields.productId; // ID of the profile to update
                const updatedData = {

                    name: request.fields.name,
                    description: request.fields.description,
                    price: request.fields.price

                };

                // Validate required fields
                if (!productId || !updatedData.name || !updatedData.description || !updatedData.price) {
                    request.status = "error";
                    request.message = "All required fields must be filled.";
                    return result.redirect("/product");
                }

                // Update the profile in the database
                await database.collection("product").updateOne({ _id: new ObjectId(productId), userId: request.session.user._id }, { $set: updatedData });

                request.status = "success";
                request.message = "product updated successfully.";
                result.redirect("/product"); // Redirect back to the profile page
            } catch (error) {
                console.error("Error updating product:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.redirect("/product");
            }
        });
        // Delete Vendor Profile
        app.post("/product/delete", async(req, res) => {
            try {
                const productId = req.fields.productId;

                // Ensure profile ID is provided
                if (!productId) {
                    req.status = "error";
                    req.message = "product ID is required for deletion.";
                    return res.redirect("/product");
                }

                // Delete the profile from the database
                const deleteResult = await database.collection("product").deleteOne({
                    _id: new ObjectId(productId),
                    userId: req.session.user._id, // Ensure the logged-in user owns the profile
                });

                if (deleteResult.deletedCount === 0) {
                    req.status = "error";
                    req.message = "No matching product found or you do not have permission to delete.";
                    return res.redirect("/product");
                }

                req.status = "success";
                req.message = "product deleted successfully.";
                res.redirect("/product");
            } catch (error) {
                console.error("Error deleting vendor product:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/product");
            }
        });


        // search files or folders
        app.get("/Search", async function(request, result) {
            const search = request.query.search;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });
                var fileUploaded = await recursiveSearch(user.uploaded, search);
                var fileShared = await recursiveSearchShared(user.sharedWithMe, search);

                // check if file is uploaded or shared with user
                if (fileUploaded == null && fileShared == null) {
                    request.status = "error";
                    request.message = "File/folder '" + search + "' is neither uploaded nor shared with you.";

                    result.render("Search", {
                        "request": request
                    });
                    return false;
                }

                var file = (fileUploaded == null) ? fileShared : fileUploaded;
                file.isShared = (fileUploaded == null);
                result.render("Search", {
                    "request": request,
                    "file": file
                });

                return false;
            }

            result.redirect("/Login");
        });

        app.get("/Blog", async function(request, result) {
            // render an HTML page with number of pages, and posts data
            result.render("Blog", {
                request: request
            });
        });






        // GET /Billing





        // get all files shared with logged-in user
        app.get("/sharedWithMe", async function(req, res) {
            if (!req.session.user) {
                return res.redirect("/Login");
            }

            const sharedLinks = await database.collection("public_links").find({
                "sharedWith.email": req.session.user.email,
            }).toArray();

            res.render("SharedWithMe", {
                mainURL: app.locals.mainURL, // Pass the main URL
                sharedLinks: sharedLinks,
                request: req,
            });
        });

        const { ObjectId } = require('mongodb');

        app.post("/payment", async function(request, result) {
            try {
                // Retrieve form fields
                var constructorName = request.fields.constructorName;
                var location = request.fields.location;
                var projectSiteName = request.fields.projectSiteName;
                var modeOfPayment = request.fields.modeOfPayment;
                var date = request.fields.date;
                var amount = request.fields.amount;

                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("payment", {
                        request: request,
                        payments: [],
                    });
                }

                // Validate required fields
                if (!constructorName ||
                    !location ||
                    !projectSiteName ||
                    !modeOfPayment ||
                    !date ||
                    !amount
                ) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const payments = await database
                        .collection("payments")
                        .find({
                            userId: request.session.user._id,
                        })
                        .toArray(); // Fetch existing payments
                    return result.render("payment", {
                        request: request,
                        payments: payments,
                    });
                }

                // Insert payment data into the database
                await database.collection("payments").insertOne({
                    userId: request.session.user._id, // Use the logged-in user's ID
                    constructorName: constructorName,
                    location: location,
                    projectSiteName: projectSiteName,
                    modeOfPayment: modeOfPayment,
                    date: new Date(date), // Convert to Date object
                    amount: parseFloat(amount), // Ensure amount is a number
                    createdAt: new Date(), // Add a timestamp
                });

                // Fetch updated payment list in descending order by creation date
                const payments = await database
                    .collection("payments")
                    .find({
                        userId: request.session.user._id,
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "Payment submitted successfully.";
                result.render("payment", {
                    request: request,
                    payments: payments, // Pass the updated payment list
                });
            } catch (error) {
                console.error("Error processing payment:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const payments = await database
                    .collection("payments")
                    .find({
                        userId: request.session.user._id,
                    })
                    .toArray(); // Fetch existing payments
                result.render("payment", { request: request, payments: payments });
            }
        });


        app.get("/payment", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("payment", {
                        request: request,
                        payments: [],
                    });
                }

                // Retrieve payments for the logged-in user in descending order by creation date
                const payments = await database
                    .collection("payments")
                    .find({
                        userId: request.session.user._id, // Use the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Payment page with the payment list
                request.status = "success";
                request.message = "Payments fetched successfully.";
                result.render("payment", {
                    request: request,
                    payments: payments, // Ensure `payments` is passed to the EJS template
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("payment", { request: request, payments: [] });
            }
        });

        app.post("/payment/share/:id", async(request, response) => {
            try {
                const paymentId = request.params.id;
                const payment = await database.collection("payment_share").findOne({
                    _id: new ObjectId(paymentId),
                });

                if (!payment) {
                    return response.status(404).json({ message: "Payment not found." });
                }

                const shareableLink = `${request.protocol}://${request.get("host")}/payment/view/${paymentId}`;

                console.log("Shareable Link:", shareableLink);

                // Additional logic for sharing (e.g., sending email)

                response.status(200).json({ message: "Payment shared successfully!" });
            } catch (error) {
                console.error("Error sharing payment:", error);
                response.status(500).json({ message: "An error occurred while sharing the payment." });
            }
        });


        app.get("/payment/share/:id", async(request, response) => {
            try {
                const paymentId = request.params.id;
                const payment = await database.collection("payments").findOne({
                    _id: new ObjectId(paymentId),
                });

                if (!payment) {
                    return response
                        .status(404)
                        .json({ message: "Payment not found." });
                }

                // Share logic here (e.g., generate a shareable link or email the details)
                const shareableLink = `${request.protocol}://${request.get(
             "host"
           )}/payment/view/${paymentId}`;

                console.log("Shareable Link:", shareableLink);
            } catch (error) {
                console.error("Error sharing payment:", error);
                response
                    .status(500)
                    .json({ message: "An error occurred while sharing the payment." });
            }
        });

        app.post("/payment/share", async(request, response) => {
            try {
                const paymentId = request.fields.paymentId; // Payment ID
                const email = request.fields.email; // Email to share with

                if (!paymentId || !email) {
                    return response
                        .status(400)
                        .json({ message: "Payment ID and email are required." });
                }

                // Check if the email exists in the `users` collection
                const userToShareWith = await database
                    .collection("users")
                    .findOne({ email: email });

                if (!userToShareWith) {
                    return response
                        .status(404)
                        .json({ message: "User with this email does not exist." });
                }

                // Check if the logged-in user exists
                const loggedInUser = await database.collection("users").findOne({
                    _id: new ObjectId(request.session.user._id),
                });

                if (!loggedInUser) {
                    return response
                        .status(401)
                        .json({ message: "Unauthorized: Please log in." });
                }

                // Insert data into `payment_share`
                await database.collection("payment_share").insertOne({
                    paymentId: new ObjectId(paymentId),
                    sharedWith: {
                        _id: userToShareWith._id,
                        email: userToShareWith.email,
                    },
                    sharedBy: {
                        _id: loggedInUser._id,
                        email: loggedInUser.email,
                    },
                    createdAt: new Date(),
                });

                return response
                    .status(200)
                    .json({ message: "Payment shared successfully!" });
            } catch (error) {
                console.error("Error sharing payment:", error);
                response.status(500).json({
                    message: "An error occurred while sharing the payment.",
                });
            }
        });


        app.post("/profile", async function(request, result) {
            try {
                // Retrieve form fields
                var location = request.fields.location;
                var name = request.fields.name;
                var busstype = request.fields.busstype;
                var email = request.fields.email;
                var offer = request.fields.offer;
                var contact = request.fields.contact;
                var coupon = request.fields.coupon;
                var storelink = request.fields.storelink;


                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("profile", {
                        request: request,
                        profile: [],
                    });
                }

                // Validate required fields
                if (!location ||
                    !name ||
                    !busstype ||
                    !offer ||
                    !contact

                ) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const profile = await database
                        .collection("profile")
                        .find({
                            userId: request.session.user._id,
                        })
                        .toArray(); // Fetch existing payments
                    return result.render("profile", {
                        request: request,
                        profile: profile,
                    });
                }

                // Insert payment data into the database
                await database.collection("profile").insertOne({
                    userId: request.session.user._id, // Use the logged-in user's ID
                    location: location,
                    name: name,
                    busstype: busstype,
                    email: email,
                    offer: offer,
                    contact: contact,
                    coupon: coupon,
                    storelink: storelink,
                    createdAt: new Date(), // Convert to Date object
                    // Add a timestamp
                });

                // Fetch updated payment list in descending order by creation date
                const profile = await database
                    .collection("profile")
                    .find({
                        userId: request.session.user._id,
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "saved successfully.";
                result.render("profile", {
                    request: request,
                    profile: profile, // Pass the updated payment list
                });
            } catch (error) {
                console.error("Error processing payment:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const profile = await database
                    .collection("profile")
                    .find({
                        userId: request.session.user._id,
                    })
                    .toArray(); // Fetch existing payments
                result.render("profile", { request: request, profile: profile });
            }
        });

        // Assuming you're using Express
        app.get('/profile/share/:id', (req, res) => {
            const profileId = req.params.id;
            // Retrieve the profile from the database using the profileId
            Profile.findById(profileId, (err, profile) => {
                if (err || !profile) {
                    return res.status(404).send('Profile not found');
                }
                // Generate a public URL (you can customize this)
                const publicUrl = `https://your-website.com/public/${profileId}`;
                res.json({ publicUrl });
            });
        });




        app.post("/chatbot", async function(request, result) {
            try {
                // Retrieve user message
                const userMessage = request.fields.message;

                // Ensure the user is logged in (optional, if necessary for your chatbot logic)
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "";
                    return result.json({
                        status: "error",
                        message: "Please log in to continue the conversation.",
                    });
                }

                // Simple chatbot logic
                let botResponse;
                let nextStep = "";

                // Check the last state of the conversation
                const conversation = await database
                    .collection("chatbot")
                    .findOne({ userId: request.session.user._id });

                if (!conversation || conversation.step === "start") {
                    // Starting conversation
                    botResponse = "Hi! Please provide your name, email, and contact number.";
                    nextStep = "collect_info";
                } else if (conversation.step === "collect_info") {
                    // Collecting user details
                    const userDetails = userMessage.split(","); // Assuming user sends details as "Name, Email, Contact"
                    if (userDetails.length !== 3) {
                        botResponse = "Please provide your details in the format: Name, Email, Contact.";
                    } else {
                        const [name, email, contact] = userDetails.map((detail) => detail.trim());
                        await database.collection("chatbot").updateOne({ userId: request.session.user._id }, { $set: { name, email, contact, step: "ask_help" } }, { upsert: true });
                        botResponse = "Thank you! How can we help you?";
                        nextStep = "ask_help";
                    }
                } else if (conversation.step === "ask_help") {
                    // Handle user query
                    await database.collection("chatbot").updateOne({ userId: request.session.user._id }, { $push: { queries: { message: userMessage, timestamp: new Date() } } });
                    botResponse = "Thank you for your query. We will get back to you soon.";
                } else {
                    botResponse = "An unexpected error occurred. Please start over.";
                    nextStep = "start";
                }

                // Save the conversation state
                await database.collection("chatbot").updateOne({ userId: request.session.user._id }, { $set: { step: nextStep } }, { upsert: true });

                // Respond to the user
                result.json({
                    status: "success",
                    botMessage: botResponse,
                });
            } catch (error) {
                console.error("Error in chatbot:", error);
                result.json({
                    status: "error",
                    message: "An unexpected error occurred.",
                });
            }
        });


        // Assuming `express` and `MongoClient` are already imported and set up

        // Render the chatbot page with messages
        app.get("/chatbot", async(req, res) => {
            try {
                // Retrieve all chat messages from the database
                const messages = await database.collection("chat_messages").find().toArray();

                // Render the chatbot page and pass the messages to the template
                res.render("chatbot", { messages });
            } catch (error) {
                console.error("Error retrieving chat messages:", error);
                res.render("chatbot", {
                    messages: [],
                    error: "Failed to retrieve chat messages.",
                });
            }
        });

        app.post("/team", async function(request, result) {
            try {
                // Retrieve form fields
                var name = request.fields.name;
                var email = request.fields.email;
                var role = request.fields.role;




                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("team", {
                        request: request,
                        team: [],
                    });
                }

                // Validate required fields
                if (!name ||
                    !email ||
                    !role

                ) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const team = await database
                        .collection("team")
                        .find({
                            userId: request.session.user._id,
                        })
                        .toArray(); // Fetch existing payments
                    return result.render("team", {
                        request: request,
                        team: team,
                    });
                }

                // Insert payment data into the database
                await database.collection("team").insertOne({
                    userId: request.session.user._id, // Use the logged-in user's ID

                    name: name,
                    email: email,
                    role: role,
                    createdAt: new Date(), // Convert to Date object
                    // Add a timestamp
                });

                // Fetch updated payment list in descending order by creation date
                const team = await database
                    .collection("team")
                    .find({
                        userId: request.session.user._id,
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "saved successfully.";
                result.render("team", {
                    request: request,
                    team: team, // Pass the updated payment list
                });
            } catch (error) {
                console.error("Error processing payment:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const team = await database
                    .collection("team")
                    .find({
                        userId: request.session.user._id,
                    })
                    .toArray(); // Fetch existing payments
                result.render("team", { request: request, team: team });
            }
        });

        app.get("/team", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("team", {
                        request: request,
                        team: [],
                    });
                }

                // Retrieve payments for the logged-in user in descending order by creation date
                const team = await database
                    .collection("team")
                    .find({
                        userId: request.session.user._id, // Use the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Payment page with the payment list
                request.status = "success";
                request.message = "Saved Successfully.";
                result.render("team", {
                    request: request,
                    team: team, // Ensure `payments` is passed to the EJS template
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("team", { request: request, team: [4] });
            }
        });

        app.get("/my-uploads", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("MyUploads", {
                        request: request,
                        team: [], // Empty team array for unauthorized access
                    });
                }

                // Fetch team data for the logged-in user
                const team = await database
                    .collection("team")
                    .find({
                        userId: request.session.user._id, // Filter by the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by creation date (latest first)
                    .toArray();

                // Pass team data to the My Uploads template
                request.status = "success";
                request.message = "Team data fetched successfully.";
                result.render("MyUploads", {
                    request: request,
                    team: team, // Pass the fetched team data to the EJS template
                });
            } catch (error) {
                console.error("Error fetching team data:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("MyUploads", {
                    request: request,
                    team: [], // Empty team array in case of an error
                });
            }
        });

        app.post("/team/update", async(req, res) => {
            try {
                // Retrieve form data
                const teamId = req.fields.teamId;
                const updatedData = {

                    name: req.fields.name,

                    email: req.fields.email,
                    role: req.fields.role,


                };

                // Validate required fields
                if (!teamId || !updatedData.name || !updatedData.email || !updatedData.role) {
                    req.status = "error";
                    req.message = "All required fields must be filled.";
                    return res.redirect("/team");
                }

                // Update the profile in the database
                const updateResult = await database.collection("team").updateOne({ _id: new ObjectId(teamId), userId: req.session.user._id }, // Match profile and user ownership
                    { $set: updatedData } // Set updated data
                );

                if (updateResult.matchedCount === 0) {
                    req.status = "error";
                    req.message = "No matching team found or you do not have permission to update.";
                    return res.redirect("/team");
                }

                req.status = "success";
                req.message = "Vendor team updated successfully.";
                res.redirect("/team");
            } catch (error) {
                console.error("Error updating vendor team:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/team");
            }
        });

        // Delete Vendor Profile
        app.post("/team/delete", async(req, res) => {
            try {
                const teamId = req.fields.teamId;

                // Ensure profile ID is provided
                if (!teamId) {
                    req.status = "error";
                    req.message = "team ID is required for deletion.";
                    return res.redirect("/team");
                }

                // Delete the profile from the database
                const deleteResult = await database.collection("team").deleteOne({
                    _id: new ObjectId(teamId),
                    userId: req.session.user._id, // Ensure the logged-in user owns the profile
                });

                if (deleteResult.deletedCount === 0) {
                    req.status = "error";
                    req.message = "No matching team found or you do not have permission to delete.";
                    return res.redirect("/team");
                }

                req.status = "success";
                req.message = "Vendor team deleted successfully.";
                res.redirect("/team");
            } catch (error) {
                console.error("Error deleting vendor team:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/team");
            }
        });



        app.get("/profile", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("profile", {
                        request: request,
                        profile: [],
                    });
                }

                // Retrieve payments for the logged-in user in descending order by creation date
                const profile = await database
                    .collection("profile")
                    .find({
                        userId: request.session.user._id, // Use the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Payment page with the payment list
                request.status = "success";
                request.message = "Saved Successfully.";
                result.render("profile", {
                    request: request,
                    profile: profile, // Ensure `payments` is passed to the EJS template
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("profile", { request: request, profile: [] });
            }
        });

        // Update Profile
        app.post("/profile/update", async(req, res) => {
            try {
                // Retrieve form data
                const profileId = req.fields.profileId;
                const updatedData = {
                    location: req.fields.location,
                    name: req.fields.name,
                    busstype: req.fields.busstype,
                    email: req.fields.email,
                    offer: req.fields.offer,
                    contact: req.fields.contact,
                    coupon: req.fields.coupon || null, // Optional
                    storelink: req.fields.storelink || null, // Optional
                };

                // Validate required fields
                if (!profileId || !updatedData.location || !updatedData.name || !updatedData.busstype || !updatedData.contact) {
                    req.status = "error";
                    req.message = "All required fields must be filled.";
                    return res.redirect("/profile");
                }

                // Update the profile in the database
                const updateResult = await database.collection("profile").updateOne({ _id: new ObjectId(profileId), userId: req.session.user._id }, // Match profile and user ownership
                    { $set: updatedData } // Set updated data
                );

                if (updateResult.matchedCount === 0) {
                    req.status = "error";
                    req.message = "No matching profile found or you do not have permission to update.";
                    return res.redirect("/profile");
                }

                req.status = "success";
                req.message = "Vendor profile updated successfully.";
                res.redirect("/profile");
            } catch (error) {
                console.error("Error updating vendor profile:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/profile");
            }
        });

        // Delete Vendor Profile
        app.post("/profile/delete", async(req, res) => {
            try {
                const profileId = req.fields.profileId;

                // Ensure profile ID is provided
                if (!profileId) {
                    req.status = "error";
                    req.message = "Profile ID is required for deletion.";
                    return res.redirect("/profile");
                }

                // Delete the profile from the database
                const deleteResult = await database.collection("profile").deleteOne({
                    _id: new ObjectId(profileId),
                    userId: req.session.user._id, // Ensure the logged-in user owns the profile
                });

                if (deleteResult.deletedCount === 0) {
                    req.status = "error";
                    req.message = "No matching profile found or you do not have permission to delete.";
                    return res.redirect("/profile");
                }

                req.status = "success";
                req.message = "Vendor profile deleted successfully.";
                res.redirect("/profile");
            } catch (error) {
                console.error("Error deleting vendor profile:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/profile");
            }
        });


        app.post("/website", async function(request, result) {
            try {
                // Retrieve form fields
                var name = request.fields.name;
                var email = request.fields.email;
                var about = request.fields.about;
                var project1 = request.fields.project1;
                var project2 = request.fields.project2;
                var project3 = request.fields.project3;
                var project1Link = request.fields.project1Link;
                var project2Link = request.fields.project2Link;
                var project3Link = request.fields.project3Link;
                var linkedin = request.fields.linkedin;
                var github = request.fields.github;
                var contactno = request.fields.contactno;


                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("website", {
                        request: request,
                        website: [],
                    });
                }

                // Validate required fields
                if (!name ||
                    !email ||
                    !about

                ) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const website = await database
                        .collection("website")
                        .find({
                            userId: request.session.user._id,
                        })
                        .toArray(); // Fetch existing payments
                    return result.render("website", {
                        request: request,
                        website: website,
                    });
                }

                // Insert payment data into the database
                await database.collection("website").insertOne({
                    userId: request.session.user._id, // Use the logged-in user's ID

                    name: name,
                    email: email,
                    about: about,
                    project1: project1,
                    project2: project2,
                    project3: project3,
                    project1Link: project1Link,
                    project2Link: project2Link,
                    project3Link: project3Link,
                    linkedin: linkedin,
                    github: github,
                    contactno: contactno,

                });

                // Fetch updated payment list in descending order by creation date
                const website = await database
                    .collection("website")
                    .find({
                        userId: request.session.user._id,
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "saved successfully.";
                result.render("website", {
                    request: request,
                    website: website, // Pass the updated payment list
                });
            } catch (error) {
                console.error("Error processing payment:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const website = await database
                    .collection("website")
                    .find({
                        userId: request.session.user._id,
                    })
                    .toArray(); // Fetch existing payments
                result.render("website", { request: request, website: [] });
            }
        });

        app.get("/website", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("website", {
                        request: request,
                        website: [],
                    });
                }

                // Retrieve payments for the logged-in user in descending order by creation date
                const website = await database
                    .collection("website")
                    .find({
                        userId: request.session.user._id, // Use the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Payment page with the payment list
                request.status = "success";
                request.message = "Saved Successfully.";
                result.render("website", {
                    request: request,
                    website: website, // Ensure `payments` is passed to the EJS template
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("website", { request: request, website: [] });
            }
        });

        app.post("/website/update", async function(request, result) {
            try {
                // Retrieve form fields
                const websiteId = request.fields.websiteId; // ID of the profile to update
                const updatedData = {

                    name: request.fields.name,
                    email: request.fields.email,
                    about: request.fields.about,
                    project1: request.fields.project1,
                    project2: request.fields.project2,
                    project3: request.fields.project3,
                    project1Link: request.fields.project1Link,
                    project2Link: request.fields.project2Link,
                    project3Link: request.fields.project3Link,
                    linkedin: request.fields.linkedin,
                    github: request.fields.github,
                    contactno: request.fields.contactno,

                };

                // Validate required fields
                if (!websiteId || !updatedData.name || !updatedData.email || !updatedData.about || !updatedData.project1 || !updatedData.project2 || !updatedData.project3 || !updatedData.project1Link || !updatedData.project2Link || !updatedData.project3Link || !updatedData.linkedin || !updatedData.github || !updatedData.contactno) {
                    request.status = "error";
                    request.message = "All required fields must be filled.";
                    return result.redirect("/website");
                }

                // Update the profile in the database
                await database.collection("website").updateOne({ _id: new ObjectId(websiteId), userId: request.session.user._id }, { $set: updatedData });

                request.status = "success";
                request.message = "website updated successfully.";
                result.redirect("/website"); // Redirect back to the profile page
            } catch (error) {
                console.error("Error updating profile:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.redirect("/website");
            }
        });


        app.post("/website/delete", async function(request, result) {
            try {
                const websiteId = request.fields.websiteId; // ID of the store entry to delete

                // Ensure the store ID is provided
                if (!websiteId) {
                    request.status = "error";
                    request.message = "website Id is required for deletion.";
                    return result.redirect("/website");
                }

                // Delete the store entry from the database
                await database.collection("website").deleteOne({
                    _id: new ObjectId(websiteId),
                    userId: request.session.user._id, // Ensure the logged-in user owns the entry
                });

                request.status = "success";
                request.message = "website entry deleted successfully.";
                result.redirect("/website"); // Redirect back to the store page
            } catch (error) {
                console.error("Error deleting store entry:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.redirect("/website");
            }
        });

        app.get('/website/view/:id', async(req, res) => {
            try {
                const websiteId = req.params.id;

                // Convert the websiteId to ObjectId (important for MongoDB queries)
                const website = await database.collection("website").findOne({ _id: new ObjectId(websiteId) });

                // Check if the website exists
                if (!website) {
                    return res.status(404).send('Website not found');
                }

                // Render the website-view template and pass the website data
                res.render('website-view', { website });
            } catch (error) {
                console.error('Error fetching website:', error);
                res.status(500).send('Server Error');
            }
        });



        const generateRandomColor = () => {
            const letters = "0123456789ABCDEF";
            let color = "#";
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        };

        // Random font generator
        const fonts = ["Arial", "Verdana", "Poppins", "Roboto", "Georgia"];
        const generateRandomFont = () => fonts[Math.floor(Math.random() * fonts.length)];

        // Route to create a website
        app.post("/website/create", (req, res) => {
            const { name, email, about } = req.body;

            // Generate random styles
            const randomColor = generateRandomColor();
            const randomFont = generateRandomFont();

            // Website content
            const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${name} - Website</title>
                <style>
                    body {
                        font-family: '${randomFont}', sans-serif;
                        background-color: ${randomColor};
                        color: white;
                        text-align: center;
                        padding: 20px;
                    }
                    h1 {
                        font-size: 3rem;
                        margin-bottom: 20px;
                    }
                    p {
                        font-size: 1.2rem;
                        margin-bottom: 15px;
                    }
                    .container {
                        margin: auto;
                        padding: 20px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        max-width: 600px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Welcome to ${name}'s Website</h1>
                    <p>Email: ${email}</p>
                    <p>About: ${about}</p>
                </div>
            </body>
            </html>
            `;

            // Save the website file
            const outputPath = path.join(__dirname, "../generated-websites", `${name}.html`);
            fs.writeFileSync(outputPath, htmlContent);

            res.json({
                message: "Website created successfully!",
                link: `/generated-websites/${name}.html`,
            });
        });

        app.get("/profileAll", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("profileall", {
                        request: request,
                        profile: [],
                    });
                }

                // Retrieve all users' profiles in descending order by creation date
                const profiles = await database
                    .collection("profile")
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the profile list
                request.status = "success";
                request.message = "Fetched all profiles successfully.";
                result.render("profileall", {
                    request: request,
                    profile: profiles, // Pass all profiles to the template
                });
            } catch (error) {
                console.error("Error fetching profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("profileall", { request: request, profile: [] });
            }
        });

        app.get("/adminprofileAll", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("adminprofileAll", {
                        request: request,
                        profile: [],
                    });
                }

                // Retrieve all users' profiles in descending order by creation date
                const profiles = await database
                    .collection("profile")
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the profile list
                request.status = "success";
                request.message = "Fetched all profiles successfully.";
                result.render("adminprofileAll", {
                    request: request,
                    profile: profiles, // Pass all profiles to the template
                });
            } catch (error) {
                console.error("Error fetching profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("adminProfileAll", { request: request, profile: [] });
            }
        });




        app.get("/Admingetuser", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("Admingetuser", {
                        request: request,
                        users: [],
                    });
                }

                // Retrieve all users' profiles in descending order by creation date
                const users = await database
                    .collection("users")
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the profile list
                request.status = "success";
                request.message = "Fetched all users successfully.";
                result.render("Admingetuser", {
                    request: request,
                    users: users, // Pass all profiles to the template
                });
            } catch (error) {
                console.error("Error fetching profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("Admingetuser", { request: request, users: [] });
            }
        });

        app.post("/Register/update", async function(req, res) {
            try {
                const userId = req.body.userId; // Ensure this matches the frontend form field name
                const updatedData = {
                    name: req.body.name,
                    email: req.body.email,
                    role: req.body.role || null, // Default to "user" if not provided
                    phone: req.body.phone || null,
                };

                // Validate required fields
                if (!userId || !updatedData.name || !updatedData.email || !updatedData.role || !updatedData.phone) {
                    req.status = "error";
                    req.message = "All required fields must be filled.";
                    return res.redirect("/Admingetuser");
                }

                // Ensure valid ObjectId format for MongoDB
                const objectId = new ObjectId(userId);

                // Update the user in the database
                const result = await database.collection("users").updateOne({ _id: objectId }, // Use the ObjectId to match the user
                    { $set: updatedData } // Update the document with the new data
                );

                if (result.matchedCount === 0) {
                    req.status = "error";
                    req.message = "User not found.";
                } else {
                    req.status = "success";
                    req.message = "User updated successfully.";
                }

                res.redirect("/Admingetuser");
            } catch (error) {
                console.error("Error updating user:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/Admingetuser");
            }
        });
        app.post("/Register/delete", async function(req, res) {
            try {
                const userId = req.body.userId; // Ensure this matches the frontend form field name

                // Validate the user ID
                if (!userId) {
                    req.status = "error";
                    req.message = "User ID is required for deletion.";
                    return res.redirect("/Admingetuser");
                }

                // Ensure valid ObjectId format for MongoDB
                const objectId = new ObjectId(userId);

                // Delete the user from the database
                const result = await database.collection("users").deleteOne({ _id: objectId });

                if (result.deletedCount === 0) {
                    req.status = "error";
                    req.message = "User not found.";
                } else {
                    req.status = "success";
                    req.message = "User deleted successfully.";
                }

                res.redirect("/Admingetuser");
            } catch (error) {
                console.error("Error deleting user:", error);
                req.status = "error";
                req.message = "An unexpected error occurred.";
                res.redirect("/Admingetuser");
            }
        });



        app.get("/admingetpayment", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("admingetpayment", {
                        request: request,
                        payments: [],
                    });
                }

                // Retrieve all users' profiles in descending order by creation date
                const payments = await database
                    .collection("payments")
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the profile list
                request.status = "success";
                request.message = "Fetched all shared payment successfully.";
                result.render("admingetpayment", {
                    request: request,
                    payments: payments, // Pass all profiles to the template
                });
            } catch (error) {
                console.error("Error fetching profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("admingetpayment", { request: request, payments: [] });
            }
        });

        app.get("/allstores", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("allstores", {
                        request: request,
                        allstores: [],
                    });
                }

                // Retrieve all users' profiles in descending order by creation date
                const store = await database
                    .collection("store")
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the profile list
                request.status = "success";
                request.message = "Fetched all shared payment successfully.";
                result.render("allstores", {
                    request: request,
                    store: store, // Pass all profiles to the template
                });
            } catch (error) {
                console.error("Error fetching profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("allstores", { request: request, store: [] });
            }
        });

        app.get("/allsharedfiles", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("allsharedfiles", {
                        request: request,
                        public_links: [],
                    });
                }

                // Retrieve all users' profiles in descending order by creation date
                const public_links = await database
                    .collection("public_links")
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the profile list
                request.status = "success";
                request.message = "Fetched all shared payment successfully.";
                result.render("allsharedfiles", {
                    request: request,
                    public_links: public_links, // Pass all profiles to the template
                });
            } catch (error) {
                console.error("Error fetching profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("allsharedfiles", { request: request, public_links: [] });
            }
        });

        app.get("/coupons", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("coupon", {
                        request: request,
                        profile: [],
                    });
                }

                // Retrieve profiles that have a coupon in descending order by creation date
                const profilesWithCoupons = await database
                    .collection("profile")
                    .find({ coupon: { $exists: true, $ne: "" } }) // Filter for documents with non-empty coupon
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Profile page with the filtered profile list
                request.status = "success";
                request.message = "Fetched coupon profiles successfully.";
                result.render("coupon", {
                    request: request,
                    profile: profilesWithCoupons, // Pass profiles with coupons to the template
                });
            } catch (error) {
                console.error("Error fetching coupon profiles:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("coupon", { request: request, profile: [] });
            }
        });

        app.post("/store", async function(request, result) {
            try {
                // Retrieve fixed form fields
                const storeName = request.fields.storeName;
                const contactDetails = request.fields.contactDetails;
                const address = request.fields.address;

                // Retrieve dynamic fields
                const products = Array.isArray(request.fields.product) ? request.fields.product : [request.fields.product];
                const availabilities = Array.isArray(request.fields.availability) ? request.fields.availability : [request.fields.availability];
                const stocks = Array.isArray(request.fields.stock) ? request.fields.stock : [request.fields.stock];
                const amounts = Array.isArray(request.fields.amount) ? request.fields.amount : [request.fields.amount];

                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("store", {
                        request: request,
                        store: [],
                    });
                }

                // Validate required fields
                if (!storeName || !contactDetails || !address || products.length === 0) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const store = await database
                        .collection("store")
                        .find({ userId: request.session.user._id })
                        .toArray();
                    return result.render("store", {
                        request: request,
                        store: store,
                    });
                }

                // Prepare entries for insertion
                const storeEntries = products.map((product, index) => ({
                    userId: request.session.user._id,
                    storeName: storeName,
                    contactDetails: contactDetails,
                    address: address,
                    product: product,
                    availability: availabilities[index] || null,
                    stock: stocks[index] || null,
                    amount: parseFloat(amounts[index]) || 0,
                    createdAt: new Date(),
                }));

                // Insert entries into the database
                await database.collection("store").insertMany(storeEntries);

                // Fetch updated store data
                const store = await database
                    .collection("store")
                    .find({ userId: request.session.user._id })
                    .sort({ createdAt: -1 })
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "Store entries submitted successfully.";
                result.render("store", {
                    request: request,
                    store: store,
                });
            } catch (error) {
                console.error("Error processing store:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const store = await database
                    .collection("store")
                    .find({ userId: request.session.user._id })
                    .toArray();
                result.render("store", { request: request, store: store });
            }
        });

        app.get("/store", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("store", {
                        request: request,
                        store: [],
                    });
                }

                // Fetch store data for the logged-in user
                const store = await database
                    .collection("store")
                    .find({
                        userId: request.session.user._id, // Retrieve records specific to the logged-in user
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the store page with retrieved data
                request.status = "success";
                request.message = "Store data fetched successfully.";
                result.render("store", {
                    request: request,
                    store: store, // Pass the store data to the EJS template
                });
            } catch (error) {
                console.error("Error fetching store data:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("store", { request: request, store: [] });
            }
        });

        app.post("/store/delete", async function(request, result) {
            try {
                const storeId = request.fields.storeId; // ID of the store entry to delete

                // Ensure the store ID is provided
                if (!storeId) {
                    request.status = "error";
                    request.message = "Store ID is required for deletion.";
                    return result.redirect("/store");
                }

                // Delete the store entry from the database
                await database.collection("store").deleteOne({
                    _id: new ObjectId(storeId),
                    userId: request.session.user._id, // Ensure the logged-in user owns the entry
                });

                request.status = "success";
                request.message = "Store entry deleted successfully.";
                result.redirect("/store"); // Redirect back to the store page
            } catch (error) {
                console.error("Error deleting store entry:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.redirect("/store");
            }
        });
        app.post("/store/update", async function(request, result) {
            try {
                // Retrieve form fields
                const storeId = request.fields.storeId; // ID of the store entry to update
                const updatedData = {

                    storeName: request.fields.storeName,
                    contactDetails: request.fields.contactDetails,
                    address: request.fields.address,
                    product: request.fields.product,
                    availability: request.fields.availability,
                    stock: request.fields.stock,
                    amount: parseFloat(request.fields.amount), // Ensure amount is a number
                };

                // Validate required fields
                if (!storeId || !updatedData.product || !updatedData.availability || !updatedData.stock || !updatedData.amount) {
                    request.status = "error";
                    request.message = "All fields are required for update.";
                    return result.redirect("/store");
                }

                // Update the store entry in the database
                await database.collection("store").updateOne({ _id: new ObjectId(storeId), userId: request.session.user._id }, { $set: updatedData });

                request.status = "success";
                request.message = "Store entry updated successfully.";
                result.redirect("/store"); // Redirect back to the store page
            } catch (error) {
                console.error("Error updating store entry:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.redirect("/store");
            }
        });


        app.post("/notes", async function(req, res) {
            try {
                const { name, paid, purpose } = req.fields;

                if (!req.session.user) {
                    req.session.status = "error";
                    req.session.message = "Unauthorized: Please log in.";
                    return res.redirect("/notes");
                }

                const userId = req.session.user._id;

                // Validate input
                if (!name || !paid || !purpose || isNaN(paid) || parseFloat(paid) <= 0) {
                    req.session.status = "error";
                    req.session.message = "Please fill in all fields correctly.";
                    return res.redirect("/notes");
                }

                const paidAmount = parseFloat(paid);

                // Fetch current balance
                const transactions = await database
                    .collection("credits")
                    .find({ userId: userId })
                    .toArray();

                const totalCredits = transactions
                    .filter((txn) => txn.type === "Credit")
                    .reduce((sum, txn) => sum + txn.amount, 0);

                const totalDebits = transactions
                    .filter((txn) => txn.type === "Debit")
                    .reduce((sum, txn) => sum + txn.amount, 0);

                const currentBalance = totalCredits - totalDebits;

                // Check if paid amount exceeds the current balance
                if (paidAmount > currentBalance) {
                    req.session.status = "error";
                    req.session.message = "Insufficient balance.";
                    return res.redirect("/notes");
                }

                // Insert the note into the database with the purpose
                await database.collection("notes").insertOne({
                    userId: userId,
                    name: name.trim(),
                    paid: paidAmount,
                    purpose: purpose.trim(),
                    createdAt: new Date(),
                });

                // Record the debit in the credits table
                await database.collection("credits").insertOne({
                    userId: userId,
                    amount: paidAmount,
                    type: "Debit",
                    date: new Date(),
                });

                req.session.status = "success";
                req.session.message = "Note added successfully.";
                res.redirect("/notes");
            } catch (error) {
                console.error("Error adding note:", error);
                req.session.status = "error";
                req.session.message = "An unexpected error occurred.";
                res.redirect("/notes");
            }
        });



        app.get("/notes", async function(req, res) {
            try {
                if (!req.session.user) {
                    req.session.status = "error";
                    req.session.message = "Unauthorized: Please log in.";
                    return res.redirect("/login");
                }

                const userId = req.session.user._id;

                // Fetch all transactions (credits and debits)
                const transactions = await database
                    .collection("credits")
                    .find({ userId: userId })
                    .toArray();

                // Calculate current balance
                const totalCredits = transactions
                    .filter((txn) => txn.type === "Credit")
                    .reduce((sum, txn) => sum + txn.amount, 0);

                const totalDebits = transactions
                    .filter((txn) => txn.type === "Debit")
                    .reduce((sum, txn) => sum + txn.amount, 0);

                const currentBalance = totalCredits - totalDebits;

                // Fetch notes for the logged-in user
                const notes = await database
                    .collection("notes")
                    .find({ userId: userId })
                    .sort({ createdAt: -1 })
                    .toArray();

                // Group notes by purpose
                const notesByPurpose = notes.reduce((groups, note) => {
                    const purpose = note.purpose || "Unknown";
                    if (!groups[purpose]) {
                        groups[purpose] = { total: 0, notes: [] };
                    }
                    groups[purpose].total += note.paid;
                    groups[purpose].notes.push(note);
                    return groups;
                }, {});

                res.render("notes", {
                    request: req,
                    currentBalance: currentBalance,
                    notesByPurpose: notesByPurpose,
                });
            } catch (error) {
                console.error("Error fetching notes:", error);
                res.status(500).send("An error occurred.");
            }
        });



        app.get("/mycredit", async function(req, res) {
            try {
                if (!req.session.user) {
                    req.session.status = "error";
                    req.session.message = "Unauthorized: Please log in.";
                    return res.redirect("/login");
                }

                const userId = req.session.user._id;

                // Fetch credit and debit history for the logged-in user
                const transactions = await database
                    .collection("credits")
                    .find({ userId: userId })
                    .sort({ date: -1 }) // Sort by date in descending order
                    .toArray();

                // Calculate total credits and debits
                const totalCredits = transactions
                    .filter((txn) => txn.type === "Credit")
                    .reduce((sum, txn) => sum + txn.amount, 0);

                const totalDebits = transactions
                    .filter((txn) => txn.type === "Debit")
                    .reduce((sum, txn) => sum + txn.amount, 0);

                // Calculate current balance
                const currentBalance = totalCredits - totalDebits;

                res.render("mycredit", {
                    request: req,
                    currentBalance: currentBalance, // Pass currentBalance to the template
                    transactions: transactions // Pass all transactions for the table
                });
            } catch (error) {
                console.error("Error fetching credit data:", error);
                res.status(500).send("An error occurred.");
            }
        });



        app.post("/mycredit", async function(req, res) {
            try {
                if (!req.session.user) {
                    req.session.status = "error";
                    req.session.message = "Unauthorized: Please log in.";
                    return res.redirect("/login");
                }

                const { amount, purpose, transactionType, reason } = req.fields;

                // Validate the input
                if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                    req.session.status = "error";
                    req.session.message = "Please enter a valid amount.";
                    return res.redirect("/mycredit");
                }

                const userId = req.session.user._id;
                const amountValue = parseFloat(amount);

                // Insert the transaction record
                await database.collection("credits").insertOne({
                    userId: userId,
                    amount: amountValue,
                    purpose: purpose,
                    type: transactionType,
                    reason: transactionType === "Debit" ? reason : null,
                    date: new Date(),
                });

                req.session.status = "success";
                req.session.message = transactionType === "Credit" ? "Amount added successfully." : "Amount debited successfully.";
                res.redirect("/mycredit");
            } catch (error) {
                console.error("Error processing transaction:", error);
                req.session.status = "error";
                req.session.message = "An unexpected error occurred.";
                res.redirect("/mycredit");
            }
        });



        app.get("/sharedpayments", async(request, response) => {
            try {
                if (!request.session.user) {
                    return response.redirect("/login");
                }

                const userId = new ObjectId(request.session.user._id);

                // Fetch payments shared with the logged-in user
                const sharedWithMe = await database
                    .collection("payment_share")
                    .aggregate([{
                            $match: { "sharedWith._id": userId },
                        },
                        {
                            $lookup: {
                                from: "payments",
                                localField: "paymentId",
                                foreignField: "_id",
                                as: "paymentDetails",
                            },
                        },
                        { $unwind: "$paymentDetails" },
                        {
                            $project: {
                                _id: 1,
                                paymentId: 1,
                                sharedBy: 1,
                                sharedWith: 1,
                                createdAt: 1,
                                "paymentDetails.constructorName": 1,
                                "paymentDetails.location": 1,
                                "paymentDetails.projectSiteName": 1,
                                "paymentDetails.modeOfPayment": 1,
                                "paymentDetails.date": 1,
                                "paymentDetails.amount": 1,
                            },
                        },
                    ])
                    .toArray();

                // Fetch payments shared by the logged-in user
                const sharedByMe = await database
                    .collection("payment_share")
                    .aggregate([{
                            $match: { "sharedBy._id": userId },
                        },
                        {
                            $lookup: {
                                from: "payments",
                                localField: "paymentId",
                                foreignField: "_id",
                                as: "paymentDetails",
                            },
                        },
                        { $unwind: "$paymentDetails" },
                        {
                            $project: {
                                _id: 1,
                                paymentId: 1,
                                sharedBy: 1,
                                sharedWith: 1,
                                createdAt: 1,
                                "paymentDetails.constructorName": 1,
                                "paymentDetails.location": 1,
                                "paymentDetails.projectSiteName": 1,
                                "paymentDetails.modeOfPayment": 1,
                                "paymentDetails.date": 1,
                                "paymentDetails.amount": 1,
                            },
                        },
                    ])
                    .toArray();

                // Render the page with both data sets
                response.render("sharedpayments", {
                    sharedWithMe,
                    sharedByMe,
                    request,
                });
            } catch (error) {
                console.error("Error fetching shared payments:", error);
                response.render("sharedpayments", {
                    sharedWithMe: [],
                    sharedByMe: [],
                    request,
                });
            }
        });







        let materials = []; // In-memory materials array for simplicity

        // Add material



        app.get("/materials", function(request, result) {
            result.render("materials", {
                "request": request
            });
        });

        app.get("/notes", function(request, result) {
            result.render("notes", {
                "request": request
            });
        });





        // app.get('/payment', (req, res) => {
        //     if (!req.session.user) {
        //         return res.redirect('/Login');
        //     }

        //     res.render('payment', {
        //         mainURL: app.locals.mainURL, // Pass the main URL or other required data
        //         request: req // Optionally pass the request object for dynamic rendering
        //     });
        // });



        app.post("/DeleteLink", async function(request, result) {

            const _id = request.fields._id;

            if (request.session.user) {
                var link = await database.collection("public_links").findOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                if (link == null) {
                    request.session.status = "error";
                    request.session.message = "Link does not exists.";

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                    return false;
                }

                await database.collection("public_links").deleteOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                request.session.status = "success";
                request.session.message = "Link has been deleted.";

                const backURL = request.header("Referer") || "/";
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });


        app.get("/estimation", (req, res) => {
            res.render("estimation");
        });

        app.get("/MySharedLinks", async function(request, result) {
            if (request.session.user) {
                var links = await database.collection("public_links").find({
                    "uploadedBy._id": ObjectId(request.session.user._id)
                }).toArray();

                result.render("MySharedLinks", {
                    "request": request,
                    "links": links
                });
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/SharedViaLink/:hash", async function(request, result) {
            const hash = request.params.hash;

            var link = await database.collection("public_links").findOne({
                "hash": hash
            });

            if (link == null) {
                request.session.status = "error";
                request.session.message = "Link expired.";

                result.render("SharedViaLink", {
                    "request": request
                });
                return false;
            }

            result.render("SharedViaLink", {
                "request": request,
                "link": link
            });
        });

        app.post("/ShareViaLink", async function(request, result) {
            const { _id, email, projectName } = request.fields; // Extract projectName

            if (request.session.user) {
                const user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id),
                });

                const recipient = await database.collection("users").findOne({
                    email: email, // Check if the email exists
                });

                if (!recipient) {
                    // If recipient email is not registered
                    request.session.status = "error";
                    request.session.message = "Recipient email is not registered!";
                    return result.redirect("back");
                }

                const file = await recursiveGetFile(user.uploaded, _id);

                if (!file) {
                    request.session.status = "error";
                    request.session.message = "File does not exist.";
                    return result.redirect("back");
                }

                bcrypt.hash(file.name, 10, async function(error, hash) {
                    hash = hash.substring(10, 20);
                    const link = `${mainURL}/SharedViaLink/${hash}`;

                    await database.collection("public_links").insertOne({
                        hash: hash,
                        file: file,
                        projectName: projectName, // Store the project name
                        sharedWith: {
                            _id: recipient._id,
                            email: recipient.email,
                            name: recipient.name,
                        },
                        uploadedBy: {
                            _id: user._id,
                            email: user.email,
                            name: user.name,
                        },
                        createdAt: new Date().getTime(),
                    });

                    request.session.status = "success";
                    request.session.message = `Share link for project "${projectName}" sent to ${email}: ${link}`;
                    result.redirect("back");
                });
            } else {
                result.redirect("/Login");
            }
        });




        // delete uploaded file
        app.post("/DeleteFile", async function(request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var updatedArray = await removeFileReturnUpdated(user.uploaded, _id);
                for (var a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });

        // download file
        app.post("/DownloadFile", async function(request, result) {
            const _id = request.fields._id;

            var link = await database.collection("public_links").findOne({
                "file._id": ObjectId(_id)
            });

            if (link != null) {
                fileSystem.readFile(link.file.filePath, function(error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": link.file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": link.file.name
                    });
                });
                return false;
            }

            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var fileUploaded = await recursiveGetFile(user.uploaded, _id);

                if (fileUploaded == null) {
                    result.json({
                        "status": "error",
                        "message": "File is neither uploaded nor shared with you."
                    });
                    return false;
                }

                var file = fileUploaded;

                fileSystem.readFile(file.filePath, function(error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": file.name
                    });
                });
                return false;
            }

            result.json({
                "status": "error",
                "message": "Please login to perform this action."
            });
            return false;
        });

        app.get("/DownloadFile/:id", async(req, res) => {
            try {
                const fileId = req.params.id;

                // Check if the file is shared via a public link
                const link = await database.collection("public_links").findOne({
                    "file._id": ObjectId(fileId)
                });

                if (link) {
                    const filePath = link.file.filePath;
                    return res.download(filePath, link.file.name);
                }

                // If user is logged in, check their uploaded files
                if (req.session.user) {
                    const user = await database.collection("users").findOne({
                        "_id": ObjectId(req.session.user._id)
                    });

                    const fileUploaded = await recursiveGetFile(user.uploaded, fileId);

                    if (!fileUploaded) {
                        return res.status(404).send("File not found.");
                    }

                    return res.download(fileUploaded.filePath, fileUploaded.name);
                }

                res.status(401).send("Please login to download this file.");
            } catch (error) {
                console.error("Error downloading file:", error);
                res.status(500).send("An error occurred.");
            }
        });


        // view all files uploaded by logged-in user
        app.get("/MyUploads", async function(request, result) {
            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var uploaded = user.uploaded;

                result.render("MyUploads", {
                    "request": request,
                    "uploaded": uploaded
                });
                return false;
            }

            result.redirect("/Login");
        });

        // upload new file
        app.post("/UploadFile", async function(request, result) {
            if (request.session.user) {
                const user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id),
                });

                const folder = request.fields.folder || ""; // Folder name (empty if root)
                const folderPath = `public/uploads/${user.email}/${folder}`;

                if (request.files.file.size > 0) {
                    // Convert file size to KB or MB
                    function formatFileSize(bytes) {
                        if (bytes < 1024) {
                            return bytes + " B";
                        } else if (bytes < 1024 * 1024) {
                            return (bytes / 1024).toFixed(2) + " KB";
                        } else {
                            return (bytes / (1024 * 1024)).toFixed(2) + " MB";
                        }
                    }

                    const uploadedObj = {
                        "_id": ObjectId(),
                        "size": request.files.file.size, // Store original size in bytes
                        "formattedSize": formatFileSize(request.files.file.size), // Store formatted size
                        "name": request.files.file.name,
                        "type": request.files.file.type,
                        "filePath": "",
                        "createdAt": new Date().getTime(),
                    };

                    const filePath = `${folderPath}/${new Date().getTime()}-${request.files.file.name}`;
                    uploadedObj.filePath = filePath;

                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath, { recursive: true });
                    }

                    fs.readFile(request.files.file.path, function(err, data) {
                        if (err) throw err;

                        fs.writeFile(filePath, data, async function(err) {
                            if (err) throw err;

                            await database.collection("users").updateOne({ "_id": ObjectId(request.session.user._id) }, { $push: { "uploaded": uploadedObj } });

                            request.session.status = "success";
                            request.session.message = "File has been uploaded.";
                            result.redirect("/MyUploads");
                        });

                        fs.unlink(request.files.file.path, function(err) {
                            if (err) throw err;
                        });
                    });
                } else {
                    request.session.status = "error";
                    request.session.message = "Please select a valid file.";
                    result.redirect("/MyUploads");
                }
            } else {
                result.redirect("/Login");
            }
        });

        app.get("/PreviewFile/:fileId", async(req, res) => {
            try {
                const fileId = req.params.fileId;
                const file = await database.collection("users").findOne({
                    "uploaded._id": ObjectId(fileId),
                });

                if (!file) {
                    return res.status(404).send("File not found");
                }

                const uploadedFile = file.uploaded.find(
                    (uploaded) => uploaded._id.toString() === fileId
                );

                if (!uploadedFile) {
                    return res.status(404).send("File not found");
                }

                const filePath = path.join(__dirname, uploadedFile.filePath);

                if (!fs.existsSync(filePath)) {
                    return res.status(404).send("File not found");
                }

                const fileType = uploadedFile.type;
                res.setHeader("Content-Type", fileType);

                if (fileType.startsWith("image/") || fileType === "application/pdf" || fileType === "application/doc") {
                    // Send image or PDF files
                    res.sendFile(filePath);
                } else if (fileType.startsWith("text/")) {
                    // Read and send text files
                    const content = fs.readFileSync(filePath, "utf-8");
                    res.send(`<pre>${content}</pre>`);
                } else if (
                    fileType === "application/doc" || // doc
                    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || // docx
                    fileType === "application/vnd.ms-excel" || // xls
                    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // xlsx
                    fileType === "application/vnd.ms-powerpoint" || // ppt
                    fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || // odp
                    fileType === "text/rtf" || // rtf
                    fileType === "application/epub+zip" // epub
                ) {
                    // For Office documents and RTF/EPUB, suggest downloading or displaying as raw files.
                    res.download(filePath, uploadedFile.name);
                } else if (fileType === "text/html") {
                    // Render HTML files
                    const htmlContent = fs.readFileSync(filePath, "utf-8");
                    res.send(htmlContent);
                } else if (
                    ["application/x-fig", "application/x-photoshop", "image/vnd.adobe.photoshop", "application/postscript"].includes(fileType)
                ) {
                    // Preview support for fig, psd, ai, etc.
                    res.sendFile(filePath);
                } else {
                    // Unsupported file types
                    res.status(415).send("Preview for this file type is not supported yet.");
                }
            } catch (error) {
                console.error(error);
                res.status(500).send("Server error");
            }
        });





        // logout the user
        app.get("/Logout", function(request, result) {
            request.session.destroy();
            result.redirect("/");
        });

        // show page to login
        app.get("/Login", function(request, result) {
            result.render("Login", {
                "request": request
            });
        });

        // authenticate the user
        app.post("/Login", async function(request, result) {
            try {
                var role = request.fields.role;
                var email = request.fields.email;
                var password = request.fields.password;

                // Find the user by email
                var user = await database.collection("users").findOne({
                    "email": email
                });

                if (user == null) {
                    // If user not found
                    request.status = "error";
                    request.message = "Email does not exist.";
                    return result.render("Login", {
                        "request": request
                    });
                }

                // Verify password
                bcrypt.compare(password, user.password, function(error, isVerify) {
                    if (error) {
                        console.error("Error comparing passwords:", error);
                        request.status = "error";
                        request.message = "An error occurred while verifying the password.";
                        return result.render("Login", {
                            "request": request
                        });
                    }

                    if (isVerify) {
                        // Check if the role matches
                        if (user.role !== role) {
                            request.status = "error";
                            request.message = "Role is not authorized.";
                            return result.render("Login", {
                                "request": request
                            });
                        }

                        // Successful login
                        request.session.user = user;
                        return result.redirect("/");
                    }

                    // Password does not match
                    request.status = "error";
                    request.message = "Password is not correct.";
                    result.render("Login", {
                        "request": request
                    });
                });
            } catch (err) {
                console.error("Error in login route:", err);
                request.status = "error";
                request.message = "An internal server error occurred.";
                result.render("Login", {
                    "request": request
                });
            }
        });


        // register the user
        app.post("/Register", async function(request, result) {
            try {
                var name = request.fields.name;
                var email = request.fields.email;
                var password = request.fields.password;
                var role = request.fields.role; // Ensure role is passed in the request
                var phone = request.fields.phone;
                var reset_token = "";
                var isVerified = true;
                var verification_token = new Date().getTime();

                // Check if the role is "Team" and verify the email with the team table
                if (role === "Team") {
                    var teamMember = await database.collection("team").findOne({ email: email });

                    if (!teamMember) {
                        request.status = "error";
                        request.message = "Email does not match any team record. Team role registration is only allowed for team members.";
                        return result.render("Register", { request: request });
                    }
                }

                // Check if the user already exists
                var user = await database.collection("users").findOne({ email: email });

                if (user == null) {
                    // Hash the password before saving
                    bcrypt.hash(password, 10, async function(error, hash) {
                        if (error) {
                            console.error("Error hashing password:", error);
                            request.status = "error";
                            request.message = "An error occurred while processing your request.";
                            return result.render("Register", { request: request });
                        }

                        // Insert the new user into the database with the provided details
                        await database.collection("users").insertOne({
                            name: name,
                            email: email,
                            password: hash,
                            role: role,
                            phone: phone,
                            reset_token: reset_token,
                            uploaded: [],
                            sharedWithMe: [],
                            isVerified: isVerified,
                            verification_token: verification_token,
                            payments: [],
                            createdAt: new Date(),
                        });

                        // Success message
                        request.status = "success";
                        request.message = "Signed up successfully. You can login now.";
                        result.render("Register", { request: request });
                    });
                } else {
                    request.status = "error";
                    request.message = "Email already exists.";
                    result.render("Register", { request: request });
                }
            } catch (error) {
                console.error("Error during registration:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("Register", { request: request });
            }
        });



        const Razorpay = require('razorpay');

        app.post('/create-order', async(req, res) => {
            const razorpay = new Razorpay({
                key_id: 'rzp_test_hKRDLdPGnrDgjY',
                key_secret: 'aQoElBR4IhLig7aMj31sBo9l'
            });

            const options = {
                amount: 49900, // ₹1 in paise
                currency: "INR",
                receipt: "receipt#1",
                payment_capture: 1
            };

            try {
                const order = await razorpay.orders.create(options);
                res.json({
                    orderId: order.id,
                    amount: order.amount
                });
            } catch (error) {
                console.error("Error creating order:", error);
                res.status(500).send("Error creating order");
            }
        });

        app.post('/paymenting/success', async(req, res) => {

            var userId = request.fields.userId;
            var payment_id = request.fields.payment_id;
            var order_id = request.fields.order_id;
            var razorpay_signature = request.fields.razorpay_signature;

            // Replace with your actual Razorpay key secret
            const key_secret = 'aQoElBR4IhLig7aMj31sBo9l';

            // Generate signature using order_id + "|" + payment_id
            const generated_signature = crypto.createHmac('sha256', key_secret)
                .update(order_id + "|" + payment_id)
                .digest('hex');

            if (generated_signature === razorpay_signature) {
                try {
                    const currentExpiry = new Date();
                    currentExpiry.setDate(currentExpiry.getDate() + 30);

                    await database.collection('users').updateOne({ _id: ObjectId(userId) }, { $set: { subscriptionExpiry: currentExpiry } });

                    res.json({ message: "Payment successful. Subscription extended." });
                } catch (error) {
                    console.error('Database update error:', error);
                    res.status(500).json({ message: 'Internal Server Error' });
                }
            } else {
                res.status(400).json({ message: 'Invalid signature. Payment verification failed.' });
            }
        });


        // Backend Route to Render Billing Page
        app.get("/billing", (req, res) => {
            // Generate a random 6-digit invoice number
            const invoice_number = "INV-" + Math.floor(100000 + Math.random() * 900000);

            // Render the billing page and pass the invoice_number to the template
            res.render("billing", {
                invoice_number: invoice_number
            });
        });
        app.get("/bill2", (req, res) => {
            // Generate a random 6-digit invoice number
            const invoice_number = "INV-" + Math.floor(100000 + Math.random() * 900000);

            // Render the billing page and pass the invoice_number to the template
            res.render("bill2", {
                invoice_number: invoice_number
            });
        });
        const itemSchema = new mongoose.Schema({
            name: String,
            quantity: Number,
            price: Number
        });

        const billSchema = new mongoose.Schema({
            invoiceNumber: String,
            customerName: String,
            customerEmail: String,
            items: [itemSchema],
            total: Number,
            date: { type: Date, default: Date.now }
        });

        const paymentSchema = new mongoose.Schema({
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            }, // Reference to the user
            constructorName: { type: String, required: true },
            location: { type: String, required: true },
            projectSiteName: { type: String, required: true },
            modeOfPayment: { type: String, required: true },
            date: { type: Date, required: true },
            amount: { type: Number, required: true },
        });

        const Bill = mongoose.model('bill', billSchema);
        const Payment = mongoose.model("Payment", paymentSchema);
        app.use(express.json());
        // API Routes
        app.post('/submitBill', async(req, res) => {
            try {
                const { invoice_number, customer_name, customer_email, items, total } = req.body;

                // Check for missing fields
                if (!invoice_number || !customer_name || !customer_email || !items || !total) {
                    return res.status(400).json({ message: 'All fields are required' });
                }

                // Create new bill
                const newBill = new Bill({
                    invoiceNumber: invoice_number,
                    customerName: customer_name,
                    customerEmail: customer_email,
                    items,
                    total
                });

                // Save to MongoDB
                const savedBill = await newBill.save();
                res.status(201).json({
                    message: 'Bill saved successfully',
                    bill: savedBill
                });
            } catch (err) {
                console.error('Error saving bill:', err); // Log error for debugging
                res.status(500).json({
                    message: 'Server error',
                    error: err.message
                });
            }
        });
        app.get('/bills', async(req, res) => {
            try {
                const bills = await Bill.find().exec(); // Ensure it uses `.exec()`
                res.status(200).json(bills);
            } catch (err) {
                console.error('Error fetching bills:', err);
                res.status(500).json({ message: 'Server error', error: err.message });
            }
        });


        app.get('/submitBill', async(req, res) => {
            try {
                const { invoiceNumber } = req.params;
                const bill = await Bill.findOne({ invoiceNumber }); // Find the bill by invoiceNumber

                if (!bill) {
                    return res.status(404).json({
                        message: 'Bill not found'
                    });
                }

                res.status(200).json({
                    message: 'Bill retrieved successfully',
                    bill
                });
            } catch (err) {
                console.error('Error fetching bill:', err);
                res.status(500).json({
                    message: 'Server error',
                    error: err.message
                });
            }
        });







        // show page to do the registration
        app.get("/Register", function(request, result) {
            result.render("Register", {
                "request": request
            });
        });

        app.post("/summary", async function(request, result) {
            try {
                // Retrieve form fields from the request
                var masterBedroom = request.fields.masterBedroom;
                var attachedBathroom = request.fields.attachedBathroom;
                var bedroom2 = request.fields.bedroom2;
                var commonBathroom = request.fields.commonBathroom;
                var livingRoom = request.fields.livingRoom;
                var kitchen = request.fields.kitchen;
                var diningSpace = request.fields.diningSpace;
                var utilityArea = request.fields.utilityArea;
                var porch = request.fields.porch;
                var sitout = request.fields.sitout;

                // Validate required fields
                if (!masterBedroom || !attachedBathroom || !bedroom2 || !commonBathroom ||
                    !livingRoom || !kitchen || !diningSpace || !utilityArea || !porch || !sitout) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    return result.render("summary", { request: request, summary: null });
                }

                // Save the summary data into the database if needed
                // Assuming we want to store this data for future reference
                await database.collection("summary").insertOne({
                    userId: request.session.user._id, // Ensure user session is present
                    masterBedroom: masterBedroom,
                    attachedBathroom: attachedBathroom,
                    bedroom2: bedroom2,
                    commonBathroom: commonBathroom,
                    livingRoom: livingRoom,
                    kitchen: kitchen,
                    diningSpace: diningSpace,
                    utilityArea: utilityArea,
                    porch: porch,
                    sitout: sitout,

                    createdAt: new Date(),
                });

                request.status = "success";
                request.message = "Summary submitted successfully.";
                result.render("summary", { request: request, summary: request.fields });
            } catch (error) {
                console.error("Error processing summary:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("summary", { request: request, summary: null });
            }
        });
        app.get("/summary", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("summary", { request: request, summary: null });
                }

                // Fetch the latest summary data for the logged-in user
                const summary = await database.collection("summary").findOne({
                    userId: request.session.user._id
                }, { sort: { createdAt: -1 } }); // Get the latest summary

                request.status = "success";
                request.message = "Summary fetched successfully.";
                result.render("summary", { request: request, summary: summary });
            } catch (error) {
                console.error("Error fetching summary:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("summary", { request: request, summary: null });
            }
        });





        app.get("/sharedpayments", function(request, result) {
            result.render("sharedpayments", {
                request: request,
            });
        });
        app.get("/subscribe", function(request, result) {
            result.render("subscribe", {
                request: request,
            });
        });
        app.get("/mycredits", function(request, result) {
            result.render("mycredits", {
                request: request,
            });
        });

        // home page
        app.get("/", function(request, result) {
            result.render("index", {
                "request": request
            });
        });
    });
});