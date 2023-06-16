const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());



// JWT verification
const verifyJWT = async (req, res, next) => {
    const authorization = await req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access by verifyJWT1' });
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
        await client.connect();
        // Send a ping to confirm a successful connection

        // DB Collection
        const usersCollection = client.db('summerCampDB').collection('users');
        const classesCollection = client.db('summerCampDB').collection('classes');
        const paymentsCollection = client.db('summerCampDB').collection('payments');
        const classesCartCollection = client.db('summerCampDB').collection('classesCart');
        const popularTeachersCartCollection = client.db('summerCampDB').collection('popularTeachers');



        // Student verification
        const verifyStudent = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'student') {
                return res.status(403).send({ error: true, message: 'forbidden message by student' });
            }
            next();
        }

        // Instructor verification
        const verifyInstructor = async (req, res, next) => {
            const email = await req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'instructor') {
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
            const result = await usersCollection.find({ role: { $eq: 'instructor' } }).toArray();
            res.send(result);
        });

        // student api
        app.get('/user/student/:email', verifyJWT, verifyStudent, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const data = await classesCartCollection.find(query).toArray();
            data.role = 'student';
            return res.send(data);
        })

        // classes api
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find({ status: { $eq: 'approved' } }).sort({ enrolled: 1 }).toArray();
            res.send(result);
        })

        // popular classes api
        app.get('/classes/popularclasses', async (req, res) => {
            const query = { enrolled: { $gt: 5 }, status: { $eq: 'approved' } };
            const result = await classesCollection.find(query).sort({ enrolled: 1 }).limit(6).toArray();
            res.send(result);
        })

        // popular teachers api
        app.get('/teachers/popularteachers', async (req, res) => {
            const result = await popularTeachersCartCollection.find().limit(6).toArray();
            res.send(result);
        })

        // Classes Cart api
        app.post('/classes-cart', async (req, res) => {
            const data = req.body;
            const result = await classesCartCollection.insertOne(data);
            res.send(result);
        })

        app.get('/classes-cart', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/classes-cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCartCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/classes-cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const update = { $inc: { availableSeats: -1, enrolled: 1 } };

            const result = await classesCollection.findOneAndUpdate(query, update);
            res.send(result);
        });

        // Instructors api
        app.get('/users/instructor/:email', verifyJWT, verifyInstructor, async (req, res) => {
            res.send({ role: 'instructor' });
        })

        app.post('/classes', async (req, res) => {
            const data = req.body;
            const result = await classesCollection.insertOne(data);
            res.send(result);
        })

        app.get('/classes-cart/:id', verifyJWT, verifyStudent, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCartCollection.findOne(query);
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
            const result = await classesCollection.find().toArray();
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
            const result = await classesCollection.updateOne(filter, updateDoc);
            return res.send(result);
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
            const deleteResult = await classesCartCollection.deleteOne(query);
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
    res.send('Summer Camp Server is running!')
})

app.listen(port, () => {
    console.log(`Summer Camp Server listening on port ${port}`)
})