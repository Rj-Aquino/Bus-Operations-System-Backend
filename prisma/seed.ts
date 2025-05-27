import { PrismaClient } from '../app/generated/prisma';
import { generateFormattedID } from '../lib/idGenerator'

const prisma = new PrismaClient();

const stopData1 = [
  { StopName: "Sapang Palay Terminal", latitude: "14.8139", longitude: "121.0452" },
  { StopName: "San Jose City Hall", latitude: "14.813", longitude: "121.045" },
  { StopName: "Muzon", latitude: "14.8135", longitude: "121.0455" },
  { StopName: "Gaya-Gaya", latitude: "14.8137", longitude: "121.0457" },
  { StopName: "Grotto", latitude: "14.814", longitude: "121.046" },
  { StopName: "SM City San Jose del Monte", latitude: "14.8142", longitude: "121.0462" },
  { StopName: "SM City Fairview", latitude: "14.815", longitude: "121.0465" },
  { StopName: "Commonwealth Ave", latitude: "14.6583", longitude: "121.0733" },
  { StopName: "Tandang Sora", latitude: "14.6751", longitude: "121.0591" },
  { StopName: "Quezon City Hall", latitude: "14.6505", longitude: "121.0499" },
  { StopName: "Welcome Rotonda", latitude: "14.6171", longitude: "121.0045" },
  { StopName: "España Blvd / UST", latitude: "14.6096", longitude: "120.9919" },
  { StopName: "Morayta", latitude: "14.6077", longitude: "120.9862" },
  { StopName: "Quiapo", latitude: "14.5995", longitude: "120.9835" },
  { StopName: "Carriedo", latitude: "14.5998", longitude: "120.9818" },
  { StopName: "Recto Avenue", latitude: "14.6003", longitude: "120.9789" },
  { StopName: "Tutuban Center", latitude: "14.6061", longitude: "120.9729" },
  { StopName: "Divisoria", latitude: "14.6011", longitude: "120.9743" },
];

const stopData2 = [
  { StopName: "Sapang Palay Terminal", latitude: "14.8139", longitude: "121.0452" },
  { StopName: "San Jose City Hall", latitude: "14.813", longitude: "121.045" },
  { StopName: "Muzon", latitude: "14.8135", longitude: "121.0455" },
  { StopName: "Gaya-Gaya", latitude: "14.8137", longitude: "121.0457" },
  { StopName: "Grotto", latitude: "14.814", longitude: "121.046" },
  { StopName: "SM City San Jose del Monte", latitude: "14.8142", longitude: "121.0462" },
  { StopName: "SM City Fairview", latitude: "14.815", longitude: "121.0465" },
  { StopName: "Commonwealth/Regalado Avenue", latitude: "14.8155", longitude: "121.0467" },
  { StopName: "Tandang Sora", latitude: "14.816", longitude: "121.047" },
  { StopName: "Central Avenue", latitude: "14.8165", longitude: "121.0472" },
  { StopName: "UP Ayala Techno Hub", latitude: "14.817", longitude: "121.0475" },
  { StopName: "Philcoa", latitude: "14.8175", longitude: "121.0477" },
  { StopName: "PCMC", latitude: "14.818", longitude: "121.048" },
  { StopName: "Lung Center of the Philippines", latitude: "14.8185", longitude: "121.0482" },
  { StopName: "Quezon City Hall Interchange", latitude: "14.819", longitude: "121.0485" },
  { StopName: "EDSA-Quezon Avenue", latitude: "14.8195", longitude: "121.0487" },
  { StopName: "Quezon-Timog Avenue", latitude: "14.82", longitude: "121.049" },
  { StopName: "Fisher Mall/Pantranco", latitude: "14.8205", longitude: "121.0492" },
  { StopName: "Fisher Mall", latitude: "14.821", longitude: "121.0495" },
  { StopName: "Morayta", latitude: "14.8215", longitude: "121.0497" },
  { StopName: "Quiapo", latitude: "14.822", longitude: "121.05" },
  { StopName: "UN Avenue", latitude: "14.8225", longitude: "121.0502" },
  { StopName: "Leveriza", latitude: "14.823", longitude: "121.0505" },
  { StopName: "Gil Puyat/Harrison", latitude: "14.8235", longitude: "121.0507" },
  { StopName: "Shell Residences", latitude: "14.824", longitude: "121.051" },
  { StopName: "Mall of Asia", latitude: "14.8245", longitude: "121.0512" },
  { StopName: "DFA", latitude: "14.825", longitude: "121.0515" },
  { StopName: "Ayala Malls Manila Bay", latitude: "14.8255", longitude: "121.0517" },
  { StopName: "PITX Arrivals/Transfers", latitude: "14.826", longitude: "121.052" },
];

async function seedQuotaPolicy() {
  const quotaPolicyData = [
    {
      StartDate: new Date('2025-01-04T08:00:00'), // 8:00 AM
      EndDate: new Date('2025-01-04T18:00:00'),   // 6:00 PM
    },
    {
      StartDate: new Date('2025-07-04T09:00:00'), // 9:00 AM
      EndDate: new Date('2025-07-04T17:00:00'),   // 5:00 PM
    },
  ];

  // Generate formatted IDs and seed data
  for (let i = 0; i < quotaPolicyData.length; i++) {
    const quotaPolicyID = await generateFormattedID('QP')
    await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: quotaPolicyID,
        StartDate: quotaPolicyData[i].StartDate,
        EndDate: quotaPolicyData[i].EndDate,
      }
    });
  }

  console.log('Quota_Policy seeded');
}

async function seedFixed() {
  const quotaPolicies = await prisma.quota_Policy.findMany(); // Fetch all QuotaPolicy records

  const fixedData = [
    { FQuotaPolicyID: quotaPolicies[0].QuotaPolicyID, Quota: 1000 },
  ];

  // Generate formatted IDs and seed data for Fixed
  for (let i = 0; i < fixedData.length; i++) {
    await prisma.fixed.create({
      data: {
        FQuotaPolicyID: fixedData[i].FQuotaPolicyID,
        Quota: fixedData[i].Quota,
      }
    });
  }

  console.log('Fixed seeded');
}

async function seedPercentage() {
  const quotaPolicies = await prisma.quota_Policy.findMany(); // Fetch all QuotaPolicy records

  const percentageData = [
    { PQuotaPolicyID: quotaPolicies[1].QuotaPolicyID, Percentage: 0.1 },
  ];

  // Generate formatted IDs and seed data for Percentage
  for (let i = 0; i < percentageData.length; i++) {
    await prisma.percentage.create({
      data: {
        PQuotaPolicyID: percentageData[i].PQuotaPolicyID,
        Percentage: percentageData[i].Percentage,
      }
    });
  }

  console.log('Percentage seeded');
}

async function seedStops() {

  // Combine and remove duplicates by StopName (first occurrence kept)
  const combinedUniqueStops = Array.from(
    new Map([...stopData1, ...stopData2].map(stop => [stop.StopName, stop])).values()
  );
  
  for (const stop of combinedUniqueStops) {
    const stopID = await generateFormattedID('STP');
    await prisma.stop.create({
      data: {
        StopID: stopID,
        StopName: stop.StopName,
        latitude: stop.latitude,
        longitude: stop.longitude,
        IsDeleted: false
      }
    });
  }

  console.log('Stops seeded');
}

async function seedRoutes() {
  // Fetch all stops
  const stops = await prisma.stop.findMany();

  // Helper function to find stop by name
  const getStopIDByName = (name: string) => {
    const stop = stops.find(s => s.StopName.toLowerCase() === name.toLowerCase());
    if (!stop) throw new Error(`Stop with name "${name}" not found.`);
    return stop.StopID;
  };

  // Get StopIDs
  const sapangPalayID = getStopIDByName('Sapang Palay Terminal');
  const pitxID = getStopIDByName('PITX Arrivals/Transfers');
  const divisoriaID = getStopIDByName('Divisoria');

  // Route: Sapang Palay ↔ PITX
  const routeID1 = await generateFormattedID('RT');
  await prisma.route.create({
    data: {
      RouteID: routeID1,
      StartStopID: sapangPalayID,
      EndStopID: pitxID,
      RouteName: 'Sapang Palay - PITX',
      IsDeleted: false
    },
  });

  // Route: Sapang Palay ↔ Divisoria
  const routeID2 = await generateFormattedID('RT');
  await prisma.route.create({
    data: {
      RouteID: routeID2,
      StartStopID: sapangPalayID,
      EndStopID: divisoriaID,
      RouteName: 'Sapang Palay - Divisoria',
      IsDeleted: false
    },
  });

  console.log('Bidirectional routes seeded successfully');
}

async function seedRouteStops() {
  const routes = await prisma.route.findMany();
  const stops = await prisma.stop.findMany();

  if (routes.length < 2 || stops.length === 0) {
    throw new Error('Insufficient routes or stops found.');
  }

  // Helper to map StopName to StopID
  const stopMap = new Map();
  for (const stop of stops) {
    stopMap.set(stop.StopName, stop.StopID);
  }

  // Only two route datasets now
  const routeStopDataSets = [
    { routeName: 'Sapang Palay - PITX', stopData: stopData1 },
    { routeName: 'Sapang Palay - Divisoria', stopData: stopData2 },
  ];

  for (const { routeName, stopData } of routeStopDataSets) {
    const route = routes.find(r => r.RouteName === routeName);
    if (!route) {
      console.warn(`⚠️ Route "${routeName}" not found. Skipping.`);
      continue;
    }

    let stopOrder = 1;

    for (const stopInfo of stopData) {
      const stopID = stopMap.get(stopInfo.StopName);
      if (!stopID) {
        console.warn(`⚠️ Stop "${stopInfo.StopName}" not found in database. Skipping.`);
        continue;
      }

      const routeStopID = await generateFormattedID('RTS');
      await prisma.routeStop.create({
        data: {
          RouteStopID: routeStopID,
          RouteID: route.RouteID,
          StopID: stopID,
          StopOrder: stopOrder,
        },
      });

      stopOrder++;
    }
  }

  console.log('RouteStops seeded successfully');
}

async function seedTicketTypes() {
  const ticketTypes = [
    { Value: 10.0 },
    { Value: 15.0 },
  ];

  for (const type of ticketTypes) {
    const ticketTypeID = await generateFormattedID('TT');
    await prisma.ticketType.create({
      data: {
        TicketTypeID: ticketTypeID,
        Value: type.Value,
      },
    });
  }

  console.log('Ticket types seeded');
}

async function seedBusAssignments() {
  const busAssignmentID1 = await generateFormattedID('BA');
  const busAssignmentID2 = await generateFormattedID('BA');

  const allRoutes = await prisma.route.findMany({ orderBy: { RouteID: 'asc' } });
  const routeID1 = allRoutes[0]?.RouteID;
  const routeID2 = allRoutes[1]?.RouteID;

  await prisma.busAssignment.create({
    data: {
      BusAssignmentID: busAssignmentID1,
      BusID: 'BUS-0001',
      RouteID: routeID1,
      AssignmentDate: new Date('2025-04-15'),
      Battery: true,
      Lights: true,
      Oil: true,
      Water: true,
      Break: true,
      Air: true,
      Gas: true,
      Engine: true,
      TireCondition: true,
      Self_Driver: true,
      Self_Conductor: true,
      Status: 'InOperation',
      IsDeleted: false,
    },
  });

  await prisma.busAssignment.create({
    data: {
      BusAssignmentID: busAssignmentID2,
      BusID: 'BUS-0002',
      RouteID: routeID2,
      AssignmentDate: new Date('2025-04-16'),
    },
  });

  console.log('Bus assignments seeded');
}

async function seedTicketBusAssignments() {
  // Fetch existing bus assignments and ticket types
  const busAssignments = await prisma.busAssignment.findMany({
    orderBy: { AssignmentDate: 'asc' },
  });
  const ticketTypes = await prisma.ticketType.findMany({
    orderBy: { TicketTypeID: 'asc' },
  });

  if (busAssignments.length === 0 || ticketTypes.length === 0) {
    throw new Error('Missing bus assignments or ticket types');
  }

  // Use first 2 ticket types for examples
  const [ticketType1, ticketType2] = ticketTypes;

  const assignments = [
    {
      BusAssignmentID: busAssignments[0].BusAssignmentID,
      TicketTypeID: ticketType1.TicketTypeID,
      StartingIDNumber: 1000,
      EndingIDNumber: 1099,
    },
    {
      BusAssignmentID: busAssignments[0].BusAssignmentID,
      TicketTypeID: ticketType2.TicketTypeID,
      StartingIDNumber: 1100,
      EndingIDNumber: 1199,
    },
    {
      BusAssignmentID: busAssignments[1].BusAssignmentID,
      TicketTypeID: ticketType1.TicketTypeID,
      StartingIDNumber: 2000,
      EndingIDNumber: 2099,
    },
  ];

  for (const a of assignments) {
    const ticketBusAssignmentID = await generateFormattedID('TBA');
    await prisma.ticketBusAssignment.create({
      data: {
        TicketBusAssignmentID: ticketBusAssignmentID,
        ...a,
      },
    });
  }

  console.log('TicketBusAssignment seeded');
}

async function seedRegularBusAssignments() {

  const [busAssignments, quotaPolicies] = await Promise.all([
    prisma.busAssignment.findMany({
      orderBy: { AssignmentDate: 'asc' },  // Order by AssignmentDate or another field
      take: 2,  // Assuming you need the first two BusAssignments
    }),
    prisma.quota_Policy.findMany({
      orderBy: { StartDate: 'asc' },  // Order by StartDate or another field
      take: 2,  // Assuming you need the first two QuotaPolicies
    }),
  ]);

  if (busAssignments.length < 2 || quotaPolicies.length < 2) {
    throw new Error('Not enough BusAssignments or QuotaPolicies to create RegularBusAssignments.');
  }

  await prisma.regularBusAssignment.createMany({
    data: [
      {
        RegularBusAssignmentID: busAssignments[0].BusAssignmentID,  // Foreign key from BusAssignments
        DriverID: "DRV-0001",             // Assuming DriverID is from API
        ConductorID: "CDT-0001",          // Assuming ConductorID is from API
        QuotaPolicyID: quotaPolicies[0].QuotaPolicyID,          
        Change: 0.05,
        TripRevenue: 1200.50,
      },
      {
        RegularBusAssignmentID: busAssignments[1].BusAssignmentID,  // Foreign key from BusAssignments
        DriverID: "DRV-0002",             // Assuming DriverID is from API
        ConductorID: "CDT-0001",          // Assuming ConductorID is from API
        QuotaPolicyID: quotaPolicies[1].QuotaPolicyID,          
        Change: 0.07,
        TripRevenue: 1300.75,
      },
    ],
  });

  console.log('Regular bus assignments seeded');
}

async function main() {
  await seedQuotaPolicy();
  await seedFixed();
  await seedPercentage();
  await seedStops();
  await seedRoutes();
  await seedRouteStops();
  await seedTicketTypes();
  await seedBusAssignments();
  await seedTicketBusAssignments();
  await seedRegularBusAssignments();
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
