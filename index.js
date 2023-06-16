const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');

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







        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Summer Camp is running!')
})

app.listen(port, () => {
    console.log(`summer camp listening on port ${port}`)
})