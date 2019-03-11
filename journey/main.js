// Imports
const bodyParser    = require( "body-parser" );
const express       = require( "express" );
const fetch         = require( "node-fetch" );
const fs            = require( "fs" );
const maps          = require( "@google/maps" );
const https         = require( "https" );
const spdy          = require( "spdy" );

// Config Setup
const app = express();
app.use( bodyParser.json() );
const mapsClient = maps.createClient({
    key: 'AIzaSyAo69wYLHHxJoIaoILPrDPZc6HfrCXmsMc',
    Promise: Promise,
});

// Variables
const PRICING_IP    = process.env.PRICING_IP || 'localhost';
const PORT          = 8203;

async function getRoute(origin, destination) {
    return await mapsClient.directions({origin, destination, mode: 'driving'})
    .asPromise()
    .then((results) => {
        return results.json.routes[0];
    })
    .catch(err => { throw(err) });
}
function isARoads(steps) {
    const routeLength = steps.length;
    steps = steps.filter(isARoad);
    return (steps.length / routeLength > 0.5) ? true : false;
}
function isARoad(step) {
    if (step.html_instructions.match(/<b>A/)) return true;
    return false;
}
async function getJourneyDetails(distance, aRoads) {
    return await fetch(`https://${PRICING_IP}:8204/`, {
        method: 'post',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'distance': distance,
            'is_a_road': aRoads,
        }),
        key: fs.readFileSync('cert/key.pem'),
        cert: fs.readFileSync('cert/cert.pem'),
        agent: new https.Agent({
            rejectUnauthorized: false,
        }),
    })
    .then(res => res.json())
    .catch(err => { throw(err) });
}

// Book new journey.
app.get( '/', async ( req, res ) => {
    try {
        const origin = req.body['start'];
        const destination = req.body['end'];

        let route = await getRoute(origin, destination), steps=[], distance=0.0;

        for (leg in route.legs) {
            steps = [].concat(steps, route.legs[leg].steps);
            distance += (route.legs[leg].distance.value / 1000);
        }

        let aRoads = isARoads(steps);
        try {
            let journey = await getJourneyDetails(distance, aRoads);
            journey = {
                'price': journey.price,
                'driver_name': journey.driver.name
            }
            res.status( 200 ).json( journey ).end();
            return;
        } catch ( e ) {
            console.log(e);
            res.status( 500 ).end(); // 500 = Internal Server Error
        }
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
    console.log( `Journey server listening on port ${PORT}...` )
});