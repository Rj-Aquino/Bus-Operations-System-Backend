import { BusOperationStatus , PrismaClient } from '@prisma/client';
import { generateFormattedID } from '../lib/idGenerator'
import {clearAllCache} from '../lib/cache';

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

async function seedStops() {
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
        IsDeleted: false,
        CreatedBy: 'OP-2024-00123',
      }
    });
  }

  console.log('Stops seeded');
}

async function seedRoutes() {
  const stops = await prisma.stop.findMany();
  const getStopIDByName = (name: string) => {
    const stop = stops.find(s => s.StopName.toLowerCase() === name.toLowerCase());
    if (!stop) throw new Error(`Stop with name "${name}" not found.`);
    return stop.StopID;
  };

  const sapangPalayID = getStopIDByName('Sapang Palay Terminal');
  const pitxID = getStopIDByName('PITX Arrivals/Transfers');
  const divisoriaID = getStopIDByName('Divisoria');

  const routeID1 = await generateFormattedID('RT');
  await prisma.route.create({
    data: {
      RouteID: routeID1,
      StartStopID: sapangPalayID,
      EndStopID: pitxID,
      RouteName: 'Sapang Palay - PITX',
      IsDeleted: false,
      CreatedBy: 'OP-2024-00123',
    },
  });

  const routeID2 = await generateFormattedID('RT');
  await prisma.route.create({
    data: {
      RouteID: routeID2,
      StartStopID: sapangPalayID,
      EndStopID: divisoriaID,
      RouteName: 'Sapang Palay - Divisoria',
      IsDeleted: false,
      CreatedBy: 'OP-2024-00123',
    },
  });

  console.log('Routes seeded');
}

async function seedRouteStops() {
  const routes = await prisma.route.findMany();
  const stops = await prisma.stop.findMany();
  const stopMap = new Map(stops.map(s => [s.StopName, s.StopID]));

  const routeStopDataSets = [
    { routeName: 'Sapang Palay - PITX', stopData: stopData1 },
    { routeName: 'Sapang Palay - Divisoria', stopData: stopData2 },
  ];

  for (const { routeName, stopData } of routeStopDataSets) {
    const route = routes.find(r => r.RouteName === routeName);
    if (!route) continue;

    let stopOrder = 1;
    for (const stop of stopData) {
      const stopID = stopMap.get(stop.StopName);
      if (!stopID) continue;

      const routeStopID = await generateFormattedID('RTS');
      await prisma.routeStop.create({
        data: {
          RouteStopID: routeStopID,
          RouteID: route.RouteID,
          StopID: stopID,
          StopOrder: stopOrder++,
          CreatedBy: 'OP-2024-00123',
        },
      });
    }
  }

  console.log('RouteStops seeded');
}

async function seedTicketTypes() {
  const types = [{ Value: 10.0 }, { Value: 15.0 }];
  for (const type of types) {
    const ticketTypeID = await generateFormattedID('TT');
    await prisma.ticketType.create({ data: { TicketTypeID: ticketTypeID, Value: type.Value, CreatedBy: 'OP-2024-00123',} });
  }
  console.log('Ticket types seeded');
}

async function seedBusAssignments() {
  const allRoutes = await prisma.route.findMany({ orderBy: { RouteID: 'asc' } });
  const routeID1 = allRoutes[0]?.RouteID;
  const routeID2 = allRoutes[1]?.RouteID;

  const ids = {
    busAssignmentID_NotStarted: await generateFormattedID('BA'),
    busAssignmentID_NotReady: await generateFormattedID('BA'),
    busAssignmentID_InOperation: await generateFormattedID('BA'),
  };

  const assignments = [
    {
      id: ids.busAssignmentID_NotStarted,
      busID: 'BUS-0001',
      routeID: routeID1,
      date: '2025-04-15',
      status: BusOperationStatus.NotStarted,
      allChecks: true,
      driverID: 'DRV-0001',
      conductorID: 'CDT-0002',
    },
    {
      id: ids.busAssignmentID_NotReady,
      busID: 'BUS-0002',
      routeID: routeID2,
      date: '2025-04-16',
      status: BusOperationStatus.NotReady,
      allChecks: false,
      driverID: 'DRV-0002',
      conductorID: 'CDT-0003',
    },
    {
      id: ids.busAssignmentID_InOperation,
      busID: 'BUS-0003',
      routeID: routeID1,
      date: '2025-04-17',
      status: BusOperationStatus.InOperation,
      allChecks: true,
      driverID: 'DRV-0003',
      conductorID: 'CDT-0004',
    },
  ];

  for (const a of assignments) {
    await prisma.busAssignment.create({
      data: {
        BusAssignmentID: a.id,
        BusID: a.busID,
        RouteID: a.routeID,
        Battery: a.allChecks,
        Lights: a.allChecks,
        Oil: a.allChecks,
        Water: a.allChecks,
        Break: a.allChecks,
        Air: a.allChecks,
        Gas: a.allChecks,
        Engine: a.allChecks,
        TireCondition: a.allChecks,
        Self_Driver: a.allChecks,
        Self_Conductor: a.allChecks,
        IsDeleted: false,
        Status: a.status,
        CreatedBy: 'OP-2024-00123',
      },
    });

  }

  console.log('Bus assignments seeded');
  return ids;
}

async function seedTicketBusTrips() {
  const busTrips = await prisma.busTrip.findMany({
    orderBy: { BusTripID: 'asc' },
  });

  const ticketTypes = await prisma.ticketType.findMany({
    orderBy: { TicketTypeID: 'asc' },
  });

  if (busTrips.length < 1 || ticketTypes.length < 2) {
    throw new Error('Not enough bus trips or ticket types to seed TicketBusTrip');
  }

  const [ticketType1, ticketType2] = ticketTypes;

  const assignments = [
    {
      BusTripID: busTrips[0].BusTripID,
      TicketTypeID: ticketType1.TicketTypeID,
      StartingIDNumber: 1000,
      EndingIDNumber: 1099,
      OverallEndingID: 1500,
      CreatedBy: 'OP-2024-00123',
    },
    {
      BusTripID: busTrips[0].BusTripID,
      TicketTypeID: ticketType2.TicketTypeID,
      StartingIDNumber: 1100,
      EndingIDNumber: 1199,
      OverallEndingID: 1500,
      CreatedBy: 'OP-2024-00123',
    },
  ];

  for (const a of assignments) {
    const ticketBusTripID = await generateFormattedID('TBT');
    await prisma.ticketBusTrip.create({
      data: {
        TicketBusTripID: ticketBusTripID,
        ...a,
      },
    });
  }

  console.log('TicketBusTrip seeded');
}

async function seedRegularBusAssignments(ids: {
  busAssignmentID_NotStarted: string,
  busAssignmentID_NotReady: string,
  busAssignmentID_InOperation: string,
}) 
{
  await prisma.regularBusAssignment.create({
    data: {
      RegularBusAssignmentID: ids.busAssignmentID_NotStarted,
      DriverID: 'DRV-0001',
      ConductorID: 'CDT-0002',
      LatestBusTripID: null,
      CreatedBy: 'OP-2024-00123',
    },
  });
  await prisma.regularBusAssignment.create({
    data: {
      RegularBusAssignmentID: ids.busAssignmentID_NotReady,
      DriverID: 'DRV-0003',
      ConductorID: 'CDT-0004',
      LatestBusTripID: null,
      CreatedBy: 'OP-2024-00123',
    },
  });
  await prisma.regularBusAssignment.create({
    data: {
      RegularBusAssignmentID: ids.busAssignmentID_InOperation,
      DriverID: 'DRV-0005',
      ConductorID: 'CDT-0006',
      CreatedBy: 'OP-2024-00123',
      // LatestBusTripID will be set after BusTrip creation
    },
  });

  console.log('Regular bus assignments seeded');
}

async function seedBusTrips(ids: {
  busAssignmentID_InOperation: string,
}) {
  const busTripID_InOperation = await generateFormattedID('BT');

  await prisma.busTrip.create({
    data: {
      BusTripID: busTripID_InOperation,
      RegularBusAssignmentID: ids.busAssignmentID_InOperation,
      DispatchedAt: new Date('2025-06-03T09:00:00Z'),
      CompletedAt: null,
      ChangeFund: 150,
      CreatedBy: 'OP-2024-00123',
    },
  });

  // Update LatestBusTripID for the one assignment
  await prisma.regularBusAssignment.update({
    where: { RegularBusAssignmentID: ids.busAssignmentID_InOperation },
    data: { LatestBusTripID: busTripID_InOperation },
  });

  console.log('BusTrip seeded and LatestBusTripID set');
}

async function seedQuotaPolicy() {
  const regularAssignments = await prisma.regularBusAssignment.findMany({ take: 2 });

  if (regularAssignments.length < 2) {
    throw new Error('Not enough RegularBusAssignments to create QuotaPolicies.');
  }

  const quotaPolicyData = [
    {
      StartDate: new Date('2025-01-04T08:00:00'),
      EndDate: new Date('2025-01-04T18:00:00'),
      RegularBusAssignmentID: regularAssignments[0].RegularBusAssignmentID,
    },
    {
      StartDate: new Date('2025-07-04T09:00:00'),
      EndDate: new Date('2025-07-04T17:00:00'),
      RegularBusAssignmentID: regularAssignments[1].RegularBusAssignmentID,
    },
  ];

  for (let i = 0; i < quotaPolicyData.length; i++) {
    const quotaPolicyID = await generateFormattedID('QP');
    await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: quotaPolicyID,
        StartDate: quotaPolicyData[i].StartDate,
        EndDate: quotaPolicyData[i].EndDate,
        RegularBusAssignmentID: quotaPolicyData[i].RegularBusAssignmentID,
        CreatedBy: 'OP-2024-00123',
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
        CreatedBy: 'OP-2024-00123',
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
        CreatedBy: 'OP-2024-00123',
      }
    });
  }

  console.log('Percentage seeded');
}

async function seedCompletedBusAssignments() {
  const routes = await prisma.route.findMany({ orderBy: { RouteID: 'asc' } });
  const ticketTypes = await prisma.ticketType.findMany({ orderBy: { TicketTypeID: 'asc' } });

  // Use today's date for all completed trips
  const today = new Date();
  today.setHours(8, 0, 0, 0); // 8:00 AM today

  for (let i = 1; i <= 5; i++) {
    const busAssignmentID = await generateFormattedID('BA');
    const busID = `BUS-${(i + 10).toString().padStart(4, '0')}`; // BUS-0011 to BUS-0015
    const driverID = `DRV-${(i + 20).toString().padStart(4, '0')}`; // DRV-0021 to DRV-0025
    const conductorID = `CDT-${(i + 20).toString().padStart(4, '0')}`; // CDT-0021 to CDT-0025
    const route = routes[i % routes.length];

    // Create BusAssignment
    await prisma.busAssignment.create({
      data: {
        BusAssignmentID: busAssignmentID,
        BusID: busID,
        RouteID: route.RouteID,
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
        IsDeleted: false,
        Status: BusOperationStatus.InOperation,
        CreatedBy: 'OP-2024-00123',
      },
    });

    // Create RegularBusAssignment
    await prisma.regularBusAssignment.create({
      data: {
        RegularBusAssignmentID: busAssignmentID,
        DriverID: driverID,
        ConductorID: conductorID,
        CreatedBy: 'OP-2024-00123',
      },
    });

    // Create BusTrip (completed) for today
    const busTripID = await generateFormattedID('BT');
    const dispatchedAt = new Date(today.getTime() + (i - 1) * 60 * 60 * 1000); // 8AM, 9AM, ..., 12PM
    const completedAt = new Date(dispatchedAt.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    const sales = 1000 + i * 100;
    const changeFund = 100 + i * 10;
    const remarks = `Completed trip for bus ${busID}`;
    const tripExpense = 200 + i * 10;

    await prisma.busTrip.create({
      data: {
        BusTripID: busTripID,
        RegularBusAssignmentID: busAssignmentID,
        DispatchedAt: dispatchedAt,
        CompletedAt: completedAt,
        Sales: sales,
        ChangeFund: changeFund,
        Remarks: remarks,
        TripExpense: tripExpense,
        Payment_Method: 'Reimbursement',
        CreatedBy: 'OP-2024-00123',
      },
    });

    // Update RegularBusAssignment with LatestBusTripID
    await prisma.regularBusAssignment.update({
      where: { RegularBusAssignmentID: busAssignmentID },
      data: { LatestBusTripID: busTripID },
    });

    // Create TicketBusTrip records for each ticket type
    for (let t = 0; t < ticketTypes.length; t++) {
      const ticketBusTripID = await generateFormattedID('TBT');
      await prisma.ticketBusTrip.create({
        data: {
          TicketBusTripID: ticketBusTripID,
          BusTripID: busTripID,
          TicketTypeID: ticketTypes[t].TicketTypeID,
          StartingIDNumber: 1000 + t * 100 + i * 10,
          EndingIDNumber: 1099 + t * 100 + i * 10,
          OverallEndingID: 1500 + t * 100 + i * 10,
          CreatedBy: 'OP-2024-00123',
        },
      });
    }
  }

  console.log('5 completed bus assignments, trips, and ticket bus trips seeded (for today)');
}

async function main() {
  await seedStops();
  await seedRoutes();
  await seedRouteStops();
  await seedTicketTypes();
  const ids = await seedBusAssignments();
  await seedRegularBusAssignments(ids);
  await seedBusTrips(ids);
  await seedTicketBusTrips();
  await seedQuotaPolicy();
  await seedFixed();
  await seedPercentage();
  await seedCompletedBusAssignments();
  await clearAllCache(); 
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
