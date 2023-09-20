const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');

// middleware
app.use(cors());
app.use(express.json());



// JWT verification
const verifyJWT = async (req, res, next) => {
    const authorization = await req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access by verifyJWT' });
    }

    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access by verifyJWT' });
        }
        req.decoded = decoded;
        next();
    })
}


// let transporter = nodemailer.createTransport({
//     host: 'smtp.sendgrid.net',
//     port: 587,
//     auth: {
//         user: "apikey",
//         pass: process.env.SENDGRID_API_KEY
//     }
// })

const auth = {
    auth: {
        api_key: process.env.EMAIL_PRIVATE_KEY,
        domain: process.env.EMAIL_DOMAIN
    }
}

const transporter = nodemailer.createTransport(mg(auth));


// Send Payment Confirmation Email
const sendPaymentConfirmationEmail = payment => {
    transporter.sendMail({
        from: "tuhinjobayergolap007@gmail.com", // verified sender email
        to: payment.email, // recipient email
        subject: "Your Order is Confirmed", // Subject line
        text: "Hello world!", // plain text body
        html: `
        <div>
        <h2>Payment Confirmed</h2>
        <p>Transaction ID: ${payment.transactionId}</p>
        </div>
        `, // html body
    }, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

}




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zuw1kb6.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();
        // Send a ping to confirm a successful connection

        // DB Collection
        const usersCollection = client.db('DonationDB').collection('users');
        const donationCollection = client.db('DonationDB').collection('classes');
        const paymentsCollection = client.db('DonationDB').collection('payments');
        const donationCartCollection = client.db('DonationDB').collection('classesCart');
        const verificationCollection = client.db('DonationDB').collection('verification');



        // Donor verification
        const verifyDonor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'user') {
                return res.status(403).send({ error: true, message: 'forbidden message by student' });
            }
            next();
        }

        // Fund Raiser verification
        const verifyFundRaiser = async (req, res, next) => {
            const email = await req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'verified') {
                return res.status(403).send({ error: true, message: 'forbidden message by student' });
            }
            next();
        }

        // Admin verification
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message by student' });
            }
            next();
        }

        // Users and JWT api
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })





        // user section api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };

            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' });
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result);
        })

        // Teacher section api
        app.get('/teachers', async (req, res) => {
            const result = await usersCollection.find({ role: { $eq: 'verified' } }).toArray();
            res.send(result);
        });

        // student api
        app.get('/user/student/:email', verifyJWT, verifyDonor, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const data = await donationCartCollection.find(query).toArray();
            data.role = 'user';
            return res.send(data);
        })

        // classes api
        app.get('/classes', async (req, res) => {
            const result = await donationCollection.find({ status: { $eq: 'approved' } }).sort({ enrolled: 1 }).toArray();
            res.send(result);
        })

        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCollection.findOne(query);
            res.send(result);
        })

        // popular classes api
        app.get('/classes/popularclasses', async (req, res) => {
            const query = { enrolled: { $gt: 5 }, status: { $eq: 'approved' } };
            const result = await donationCollection.find(query).sort({ enrolled: 1 }).limit(6).toArray();
            res.send(result);
        })


        // Classes Cart api
        app.post('/classes-cart', async (req, res) => {
            const data = req.body;
            const result = await donationCartCollection.insertOne(data);
            res.send(result);
        })

        app.get('/classes-cart', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await donationCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/classes-cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCartCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/classes-cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            // const update = { $inc: { availableSeats: -1, enrolled: 1 } };
            const update = { $inc: { enrolled: 1 } };

            const result = await donationCollection.findOneAndUpdate(query, update);
            res.send(result);
        });

        // verification api
        app.post('/verification', async (req, res) => {
            const data = req.body;
            const result = await verificationCollection.insertOne(data);
            res.send(result);
        })


        // Fund Raiser api
        app.get('/users/instructor/:email', verifyJWT, verifyFundRaiser, async (req, res) => {
            res.send({ role: 'verified' });
        })

        app.post('/classes', async (req, res) => {
            const data = req.body;
            const result = await donationCollection.insertOne(data);
            res.send(result);
        })

        app.get('/classes-cart/:id', verifyJWT, verifyDonor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCartCollection.findOne(query);
            res.send(result);
        })

        // admin api
        app.get('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            res.send({ role: 'admin' });
        })

        app.get('/all-users-data', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.patch('/all-users-data/', async (req, res) => {
            const role = req.query.role;
            const email = req.query.email;
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    role: role
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/all-classes-data', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await donationCollection.find().toArray();
            res.send(result);
        })

        app.patch('/all-classes-data', async (req, res) => {
            const feedback = req.query.feedback;
            const status = req.query.status;
            const id = req.query.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: feedback,
                    status: status
                },
            };
            const result = await donationCollection.updateOne(filter, updateDoc);
            return res.send(result);
        })

        app.get('/all-verification-data', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await verificationCollection.find().toArray();
            res.send(result);
        })

        // payment api
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.get('/payment-details/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentsCollection.find(query).sort({ data: 1 }).toArray();
            res.send(result);
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentsCollection.insertOne(payment);
            const query = { _id: new ObjectId(payment._id) };
            const deleteResult = await donationCartCollection.deleteOne(query);


            // Send an Email confirming payment Api
            sendPaymentConfirmationEmail(payment);


            res.send({ insertResult, deleteResult });
        })









        // DEFAULT CODE BELOW

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Crowd Funding Server is running!')
})

app.listen(port, () => {
    console.log(`Crowd Funding Server listening on port ${port}`)
})