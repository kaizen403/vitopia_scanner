const EVENT_SEEDS = [
  {
    "name": "Praana2026-Day1",
    "description": "PRAANA 2026 - Day 1",
    "venue": "PIMS Campus",
    "date": "1771734600000",
    "category": "day",
    "scanOrder": 1,
    "accessToken": "DAY_1"
  },
  {
    "name": "Praana2026-Day2",
    "description": "PRAANA 2026 - Day 2",
    "venue": "PIMS Campus",
    "date": "1771821000000",
    "category": "day",
    "scanOrder": 2,
    "accessToken": "DAY_2"
  },
  {
    "name": "Praana2026-Day3",
    "description": "PRAANA 2026 - Day 3",
    "venue": "PIMS Campus",
    "date": "1771907400000",
    "category": "day",
    "scanOrder": 3,
    "accessToken": "DAY_3"
  },
  {
    "name": "Mr. Pranav Sharma on 22 Feb 2026 from 2.30 PM to 3.30 PM",
    "description": "Speaker Event - Mr. Pranav Sharma",
    "venue": "PIMS Campus",
    "date": "1771750800000",
    "category": "speaker",
    "scanOrder": 4,
    "accessToken": "PRANAV"
  },
  {
    "name": "PRAANA 2026 T-Shirt Distribution",
    "description": "T-Shirt Distribution Counter",
    "venue": "PIMS Campus",
    "date": "1771903800000",
    "category": "distribution",
    "scanOrder": 6,
    "accessToken": "TSHIRT"
  },
  {
    "name": "2 & 4 Legged Race",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-1 Garden",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 100,
    "accessToken": null
  },
  {
    "name": "Balloon Burst",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-1 Outside",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 101,
    "accessToken": null
  },
  {
    "name": "Bead Your Way",
    "description": "Non-Prime Carnival Activity",
    "venue": "SAC (10×10)",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 102,
    "accessToken": null
  },
  {
    "name": "Board Game Battle Zone",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outside Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 103,
    "accessToken": null
  },
  {
    "name": "Clay Modelling",
    "description": "Non-Prime Carnival Activity",
    "venue": "Classroom",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 104,
    "accessToken": null
  },
  {
    "name": "Electric Loop Buzzer",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outside Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 105,
    "accessToken": null
  },
  {
    "name": "Escape Room",
    "description": "Non-Prime Carnival Activity",
    "venue": "Big Classroom",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 106,
    "accessToken": null
  },
  {
    "name": "Flip Bottle – Pop Balloon",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-2, G14",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 107,
    "accessToken": null
  },
  {
    "name": "Freeze Frame Freeze",
    "description": "Non-Prime Carnival Activity",
    "venue": "Classroom in CB / AB-2",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 108,
    "accessToken": null
  },
  {
    "name": "Make Your Own Perfume Workshop",
    "description": "Non-Prime Carnival Activity",
    "venue": "Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 109,
    "accessToken": null
  },
  {
    "name": "Mega Games",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-2 Classroom",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 110,
    "accessToken": null
  },
  {
    "name": "Mehendi Block Printing",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outdoor stall / AB-1 / CB classroom",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 111,
    "accessToken": null
  },
  {
    "name": "Mehendi Stall",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outside Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 112,
    "accessToken": null
  },
  {
    "name": "Mini Games",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-2 Classroom",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 113,
    "accessToken": null
  },
  {
    "name": "Musical Chairs",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-1 Backside",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 114,
    "accessToken": null
  },
  {
    "name": "Orange Coin Balance",
    "description": "Non-Prime Carnival Activity",
    "venue": "Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 115,
    "accessToken": null
  },
  {
    "name": "PIKA PIKA",
    "description": "Non-Prime Carnival Activity",
    "venue": "Online",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 116,
    "accessToken": null
  },
  {
    "name": "Pillow Fight",
    "description": "Non-Prime Carnival Activity",
    "venue": "Rockplaza / Large classroom",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 117,
    "accessToken": null
  },
  {
    "name": "POT-O-MANIA",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-2, G19",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 118,
    "accessToken": null
  },
  {
    "name": "Prop Relay Race",
    "description": "Non-Prime Carnival Activity",
    "venue": "Sport triangle-1",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 119,
    "accessToken": null
  },
  {
    "name": "Ring Toss",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outside Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 120,
    "accessToken": null
  },
  {
    "name": "Run Mat",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-1 Garden",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 121,
    "accessToken": null
  },
  {
    "name": "Sack Race",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-1 Garden",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 122,
    "accessToken": null
  },
  {
    "name": "Tattoo Stall",
    "description": "Non-Prime Carnival Activity",
    "venue": "Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 123,
    "accessToken": null
  },
  {
    "name": "Tote Bag Stall",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outside Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 124,
    "accessToken": null
  },
  {
    "name": "Upside Down Games",
    "description": "Non-Prime Carnival Activity",
    "venue": "AB-1 Classroom (curtains, 1st/2nd floor)",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 125,
    "accessToken": null
  },
  {
    "name": "ViTQuest'26",
    "description": "Non-Prime Carnival Activity",
    "venue": "Amphitheatre / Backside of ABs",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 126,
    "accessToken": null
  },
  {
    "name": "Water Activities",
    "description": "Non-Prime Carnival Activity",
    "venue": "Rockplaza",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 127,
    "accessToken": null
  },
  {
    "name": "Whisper Challenge",
    "description": "Non-Prime Carnival Activity",
    "venue": "Outside Stall",
    "date": "1740200400000",
    "category": "day",
    "scanOrder": 128,
    "accessToken": null
  },
  {
    "name": "Mr. Sarat Raja Uday Boddeda on 23rd Feb 2026 from 2.30 PM to 3.30 PM",
    "description": "Speaker Event - Mr. Sarat Raja Uday Boddeda",
    "venue": "PIMS Campus",
    "date": "1771837200000",
    "category": "speaker",
    "scanOrder": 5,
    "accessToken": "UDAY"
  }
];
