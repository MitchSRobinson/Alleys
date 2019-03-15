// Imports
const bodyParser    = require( "body-parser" );
const express       = require( "express" );
const fetch         = require( "node-fetch" );
const fs            = require( "fs" );
const https         = require( "https" );
const spdy          = require( "spdy" );

// Config Setup
const app = express();
app.use( bodyParser.json() );

// Variables
const ROSTER_IP     = process.env.ROSTER_IP || 'localhost';
const PORT          = 8204;
const NO_DRIVERS    = { error: "No drivers currently available..." };
const INCOMPLETE    = { error: "Distance is required. Must be positive." };

// Fetch a list of the drivers currently on the roster and their listed prices.
async function getDrivers() {
    return await fetch(`https://${ROSTER_IP}:8202/`, {
        key: fs.readFileSync('cert/key.pem'),
        cert: fs.readFileSync('cert/cert.pem'),
        agent: new https.Agent({
            rejectUnauthorized: false,
        }),
    })
    .then(res => res.json());
}

// Get driver and price.
app.post( '/', async ( req, res ) => {
    try {
        let drivers = await getDrivers();

        if (!drivers || drivers.length == 0) {
            console.log(`No drivers found on the roster.`);
            res.status( 404 ).json( NO_DRIVERS ).end();
            return;
        }

        const distance = req.body['distance'];
        const aRoads = req.body['is_a_road'] || false;
        if (!distance || isNaN(distance) || distance <= 0) {
            console.log(`Invalid distance: ${distance}`);
            res.status( 400 ).json( INCOMPLETE ).end();
            return;
        }

        let multiplier = 1;
        if (aRoads) multiplier = multiplier * 2;
        if (drivers.length < 5) multiplier = multiplier * 2;
        if (new Date().getHours() > 23 || new Date().getHours() < 5) multiplier = multiplier * 2;
        
        journey = { 
            driver: {
                name: drivers[0].driver,
                base_price: drivers[0].price,
            },
            multiplier,
            price: drivers[0].price * distance * multiplier
        }

        res.status( 200 ).json( journey ).end();
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Create and run HTTPS server.
const server = spdy.createServer( {
    key : fs.readFileSync( "cert/key.pem" ),
    cert : fs.readFileSync( "cert/cert.pem" )
}, app );

server.listen( PORT, () => {
    console.log( `Pricing server listening on port ${PORT}...` )
});