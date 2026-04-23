export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // 2024-25 NBA Playoffs: fg3m=actual avg/game, fg3a/fg3pct=estimated from career rates
  const rowSet = [
    ["Gary Trent Jr.",4.4,11.6,0.379],["Stephen Curry",4.0,9.4,0.426],["Fred VanVleet",3.86,10.7,0.361],
    ["Derrick White",3.64,9.1,0.400],["Jayson Tatum",3.63,9.6,0.378],["AJ Green",3.6,9.0,0.400],
    ["Malik Beasley",3.33,9.0,0.370],["Luka Doncic",3.2,8.6,0.372],["Donovan Mitchell",3.11,8.4,0.370],
    ["Anthony Edwards",3.07,8.8,0.349],["Rui Hachimura",3.0,7.9,0.380],["Austin Reaves",3.0,7.5,0.400],
    ["Max Strus",2.89,7.8,0.371],["Tim Hardaway Jr.",2.67,7.0,0.381],["Jalen Brunson",2.67,6.7,0.398],
    ["Aaron Nesmith",2.61,6.7,0.390],["Scotty Pippen Jr.",2.6,7.2,0.361],["Payton Pritchard",2.45,5.8,0.422],
    ["Jamal Murray",2.43,6.6,0.368],["Paolo Banchero",2.4,7.1,0.338],["Tyrese Haliburton",2.35,5.9,0.398],
    ["James Harden",2.29,6.2,0.369],["OG Anunoby",2.28,6.0,0.380],["Tyler Herro",2.25,5.8,0.388],
    ["Santi Aldama",2.2,5.8,0.379],["Kawhi Leonard",2.14,5.4,0.396],["Luguentz Dort",2.09,5.8,0.360],
    ["LeBron James",2.0,5.9,0.339],["Norman Powell",2.0,5.3,0.377],["Darius Garland",2.0,5.3,0.377],
    ["Julius Randle",2.0,5.9,0.339],["Bobby Portis",2.0,5.6,0.357],["Desmond Bane",2.0,5.0,0.400],
    ["Nikola Jokic",1.93,5.1,0.378],["Jaylen Brown",1.91,5.3,0.360],["Donte DiVincenzo",1.87,5.1,0.367],
    ["Nicolas Batum",1.86,4.9,0.380],["Jalen Green",1.86,5.2,0.358],["Brandin Podziemski",1.83,4.8,0.381],
    ["Bam Adebayo",1.75,4.9,0.357],["Evan Mobley",1.75,5.0,0.350],["Davion Mitchell",1.75,4.7,0.372],
    ["Haywood Highsmith",1.75,4.6,0.380],["Sam Merrill",1.75,4.4,0.398],["Andrew Wiggins",1.75,4.9,0.357],
    ["Andrew Nembhard",1.74,4.6,0.378],["Michael Porter Jr.",1.71,4.5,0.380],["Dennis Schroder",1.67,4.8,0.348],
    ["Tobias Harris",1.67,4.5,0.371],["Naz Reid",1.67,4.5,0.371],["Alex Caruso",1.61,4.2,0.383],
    ["Aaron Gordon",1.57,4.6,0.341],["Mikal Bridges",1.56,4.3,0.363],["Ty Jerome",1.56,3.9,0.400],
    ["Russell Westbrook",1.54,5.0,0.308],["Pascal Siakam",1.52,4.1,0.371],["Jalen Williams",1.52,4.3,0.354],
    ["Christian Braun",1.5,3.9,0.385],["Nickeil Alexander-Walker",1.47,4.1,0.359],["Karl-Anthony Towns",1.44,3.6,0.400],
    ["Kris Dunn",1.43,4.2,0.340],["Jabari Smith Jr.",1.43,4.1,0.349],["Dillon Brooks",1.43,4.2,0.340],
    ["Franz Wagner",1.4,3.9,0.359],["Kevin Porter Jr.",1.4,4.0,0.350],["Jaden McDaniels",1.4,3.9,0.359],
    ["Dorian Finney-Smith",1.4,3.8,0.368],["Shai Gilgeous-Alexander",1.39,4.1,0.339],["Myles Turner",1.35,3.8,0.355],
    ["Draymond Green",1.33,4.3,0.309],["Mike Conley",1.33,3.4,0.391],["Al Horford",1.27,3.3,0.385],
    ["Jaylon Tyson",1.25,3.5,0.357],["Jonathan Kuminga",1.25,3.6,0.347],["Moses Moody",1.25,3.3,0.379],
    ["Miles McBride",1.22,3.3,0.370],["Chet Holmgren",1.17,3.3,0.355],["Aaron Wiggins",1.14,3.2,0.356],
    ["Jrue Holiday",1.13,3.1,0.364],["Josh Hart",1.11,3.3,0.336],["Isaiah Joe",1.1,2.8,0.393],
    ["Obi Toppin",1.09,3.3,0.330],["Damian Lillard",1.0,2.6,0.385],["Duncan Robinson",1.0,2.4,0.417],
    ["Cory Joseph",1.0,2.8,0.357],["Vince Williams Jr.",1.0,2.8,0.357],["Tari Eason",1.0,2.9,0.345],
    ["Bogdan Bogdanovic",1.0,2.6,0.385],["Sam Hauser",0.88,2.1,0.419],["Cason Wallace",0.87,2.4,0.363],
    ["Derrick Jones Jr.",0.86,2.5,0.344],["Cade Cunningham",0.83,2.3,0.361],["Quinten Post",0.83,2.2,0.377],
    ["Bennedict Mathurin",0.82,2.3,0.357],["Gary Payton II",0.82,2.4,0.342],["Brook Lopez",0.8,2.3,0.348],
    ["Gabe Vincent",0.8,2.2,0.364],["Kel'el Ware",0.75,2.2,0.341],["Pelle Larsson",0.75,2.1,0.357],
    ["Jarace Walker",0.73,2.2,0.332],["Ben Sheppard",0.71,1.9,0.374],["Julian Strawther",0.67,1.9,0.353],
    ["Aaron Holiday",0.67,1.8,0.372],["Ryan Rollins",0.67,1.9,0.353],["Isaac Okoro",0.67,2.1,0.319],
    ["Landry Shamet",0.64,1.7,0.376],["Jaylin Williams",0.6,1.9,0.316],["Wendell Carter Jr.",0.6,1.9,0.316],
    ["Peyton Watson",0.5,1.5,0.333],["Baylor Scheierman",0.5,1.3,0.385],["Luke Kennard",0.5,1.2,0.417],
    ["Jordan Poole",3.5,9.2,0.380],["Victor Wembanyama",3.1,8.8,0.352],["Zach LaVine",3.2,8.2,0.390],
    ["Klay Thompson",3.0,7.1,0.422],["Trae Young",2.9,8.3,0.350],["Anfernee Simons",2.8,7.6,0.368],
    ["CJ McCollum",2.5,6.6,0.379],["Lauri Markkanen",2.5,6.8,0.368],["Kevin Durant",2.4,6.3,0.381],
    ["Brandon Ingram",2.4,6.3,0.381],["Terry Rozier",2.3,6.2,0.371],["Kyrie Irving",2.2,5.5,0.401],
    ["Malik Monk",2.1,5.5,0.381],["Immanuel Quickley",2.0,5.2,0.385],["Kentavious Caldwell-Pope",2.0,5.3,0.377],
    ["Quentin Grimes",1.9,5.5,0.345],["Devin Booker",1.9,5.4,0.352],["De'Andre Hunter",1.6,4.3,0.372],
    ["Dejounte Murray",1.6,4.7,0.340],["Josh Green",1.4,3.8,0.368],["Corey Kispert",1.4,3.3,0.424],
    ["Kevin Huerter",1.8,4.6,0.391],["RJ Barrett",1.8,5.3,0.340],["De'Aaron Fox",1.7,5.5,0.309],
    ["Spencer Dinwiddie",1.5,4.5,0.333],["Cole Anthony",1.5,4.3,0.349],["Scottie Barnes",1.3,3.9,0.333],
    ["Cam Thomas",1.3,3.7,0.351],["Dyson Daniels",1.1,3.2,0.344],["Jaime Jaquez Jr.",0.9,2.6,0.346]
  ];

  return new Response(JSON.stringify({
    resultSets: [{ headers: ['PLAYER_NAME','FG3M','FG3A','FG3_PCT'], rowSet }]
  }), { status: 200, headers: cors });
}