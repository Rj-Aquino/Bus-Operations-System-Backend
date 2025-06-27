import { BusOperationStatus , PrismaClient } from '@prisma/client';
import { generateFormattedID } from '../lib/idGenerator'
import {clearAllCache} from '../lib/cache';

const prisma = new PrismaClient();

const stopData2 = [
  { StopName: "Sapang Palay Terminal", latitude: "14.8590735", longitude: "121.0579250" },
  { StopName: "Sapang Palay", latitude: "14.8468253", longitude: "121.0424615" },
  { StopName: "Sapang Palay Elementary School", latitude: "14.8378988", longitude: "121.0428630" },
  { StopName: "San Jose City Hall", latitude: "14.8101188", longitude: "121.0473705" },
  { StopName: "Muzon", latitude: "14.8023370", longitude: "121.0347768" },
  { StopName: "Sta. Maria Proper (Poblacion)", latitude: "14.8184104", longitude: "120.9604852" },
  { StopName: "Governor F. Halili Avenue", latitude: "14.8106264", longitude: "120.9478695" },
  { StopName: "Bocaue Exit (NLEX)", latitude: "14.8073082", longitude: "120.9404048" },
  { StopName: "North Luzon Expressway (Southbound)", latitude: "14.7074700", longitude: "120.9928911" },
  { StopName: "5th Avenue (Caloocan)", latitude: "14.6438833", longitude: "120.9932926" },
  { StopName: "Andres Bonifacio Avenue", latitude: "14.6403125", longitude: "120.9921370" },
  { StopName: "Rizal Avenue", latitude: "14.6225441", longitude: "120.9829285" },
  { StopName: "Abad Santos Avenue", latitude: "14.6102161", longitude: "120.9759590" },
  { StopName: "Recto Avenue", latitude: "14.6066217", longitude: "120.9734967" },
  { StopName: "Divisoria", latitude: "14.6025300", longitude: "120.9697916" }

];

const stopData1 = [
  { StopName: "Sapang Palay Terminal", latitude: "14.8590735", longitude: "121.0579250" },
  { StopName: "Sapang Palay", latitude: "14.8468253", longitude: "121.0424615" },
  { StopName: "Sapang Palay Elementary School", latitude: "14.8378988", longitude: "121.0428630" },
  { StopName: "San Jose City Hall", latitude: "14.8101188", longitude: "121.0473705" },
  { StopName: "Muzon", latitude: "14.8023370", longitude: "121.0347768" },
  { StopName: "Gaya-Gaya", latitude: "14.7960413", longitude: "121.0500033" },
  { StopName: "Grotto", latitude: "14.7918429", longitude: "121.0671481" },
  { StopName: "SM City San Jose del Monte", latitude: "14.7864862", longitude: "121.0747118" },
  { StopName: "SM City Fairview", latitude: "14.7351344", longitude: "121.0571627" },
  { StopName: "Commonwealth/Mindanao Ave", latitude: "14.7209042", longitude: "121.0523427" },
  { StopName: "Commonwealth/Regalado Ave", latitude: "14.7063412", longitude: "121.0685984" },
  { StopName: "Tandang Sora", latitude: "14.6646319", longitude: "121.0687741" },
  { StopName: "Central Avenue", latitude: "14.6611110", longitude: "121.0635931" },
  { StopName: "UP Ayala Techno Hub", latitude: "14.6573173", longitude: "121.0578302" },
  { StopName: "Philcoa", latitude: "14.6539908", longitude: "121.0530038" },
  { StopName: "PCMC", latitude: "14.6467090", longitude: "121.0420314" },
  { StopName: "Lung Center of the Philippines", latitude: "14.6492730", longitude: "121.0461379" },
  { StopName: "EDSA-Quezon Avenue", latitude: "14.6436616", longitude: "121.0364381" },
  { StopName: "Quezon-Timog Avenue", latitude: "14.6366964", longitude: "121.0252015" },
  { StopName: "Fisher Mall/Pantranco", latitude: "14.6338244", longitude: "121.0204752" },
  { StopName: "Fisher Mall", latitude: "14.6324431", longitude: "121.0180594" },
  { StopName: "Santo Domingo", latitude: "14.6257169", longitude: "121.0102576" },
  { StopName: "Banawe", latitude: "14.6238540", longitude: "121.0081612" },
  { StopName: "D. Tuazon/Quezon Avenue", latitude: "14.6206612", longitude: "121.0045924" },
  { StopName: "Welcome Rotonda", latitude: "14.6187444", longitude: "121.0024788" },
  { StopName: "UST", latitude: "14.6087653", longitude: "120.9915436" },
  { StopName: "España/P. Noval", latitude: "14.6070635", longitude: "120.9896889" },
  { StopName: "Morayta", latitude: "14.6058719", longitude: "120.9884986" },
  { StopName: "Quiapo", latitude: "14.6003173", longitude: "120.9844085" },
  { StopName: "Lawton", latitude: "14.5945754", longitude: "120.9802424" },
  { StopName: "UN Avenue", latitude: "14.5817842", longitude: "120.9848689" },
  { StopName: "Leveriza", latitude: "14.5538116", longitude: "120.9950843" },
  { StopName: "Gil Puyat/Harrison", latitude: "14.5531639", longitude: "120.9915960" },
  { StopName: "Shell Residences", latitude: "14.5358701", longitude: "120.9865878" },
  { StopName: "Mall of Asia", latitude: "14.5354686", longitude: "120.9835439" },
  { StopName: "DFA", latitude: "14.5282496", longitude: "120.9898271" },
  { StopName: "Ayala Malls Manila Bay", latitude: "14.5233844", longitude: "120.9901953" },
  { StopName: "PITX LRT Interchange", latitude: "14.5092607", longitude: "120.9914706" },
  { StopName: "PITX Arrivals/Transfers", latitude: "14.5108962", longitude: "120.9911883" },
];

const busIDs = [
  'BUS-00001', 'BUS-00002', 'BUS-00003', 'BUS-00004', 'BUS-00005',
  'BUS-00006', 'BUS-00007', 'BUS-00008', 'BUS-00009', 'BUS-00010',
  'BUS-00011', 'BUS-00012', 'BUS-00013', 'BUS-00014', 'BUS-00015'
];

const driverIDs = [
  "EMP-2015-WQ690X",
  "EMP-2023-VCEDJC",
  "EMP-2023-LSHGK5",
  "EMP-2025-DS0UR2",
  "EMP-2019-X9K979",
  "EMP-2015-AJEF3J",
  "EMP-2025-VR0QPJ",
  "EMP-2017-5J4OT7",
  "EMP-2018-XP54UC",
  "EMP-2017-43R8WX",
  "EMP-2018-HKXDEL",
  "EMP-2023-0Z4NI6",
  "EMP-2022-RF81VM",
  "EMP-2024-3O3I4O",
  "EMP-2019-R1ID0J",
  "EMP-2022-1JGXRU"
];

const conductorIDs = [
  "EMP-2024-1G7B3U",
  "EMP-2022-G9TCH1",
  "EMP-2014-X7ZVS5",
  "EMP-2019-66JYD4",
  "EMP-2015-Q3L5G6",
  "EMP-2025-0YTIVR",
  "EMP-2018-F31CY4",
  "EMP-2024-ZDY56R",
  "EMP-2018-KGR5M5",
  "EMP-2019-AU3VYR",
  "EMP-2018-UTR359",
  "EMP-2016-BYQXBV",
  "EMP-2022-GWDUBZ",
  "EMP-2024-DR6EOL",
  "EMP-2016-01F53Z",
  "EMP-2024-GEIPOP",
  "EMP-2023-IUP3PT",
  "EMP-2015-D2M988",
  "EMP-2019-836G6H"
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
      busID: busIDs[0],
      routeID: routeID1,
      date: '2025-04-15',
      status: BusOperationStatus.NotStarted,
      allChecks: true,
      driverID: driverIDs[0],
      conductorID: conductorIDs[0],
    },
    {
      id: ids.busAssignmentID_NotReady,
      busID: busIDs[1],
      routeID: routeID2,
      date: '2025-04-16',
      status: BusOperationStatus.NotReady,
      allChecks: false,
      driverID: driverIDs[1],
      conductorID: conductorIDs[1],
    },
    {
      id: ids.busAssignmentID_InOperation,
      busID: busIDs[2],
      routeID: routeID1,
      date: '2025-04-17',
      status: BusOperationStatus.InOperation,
      allChecks: true,
      driverID: driverIDs[2],
      conductorID: conductorIDs[2],
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
      DriverID: driverIDs[0],
      ConductorID: conductorIDs[0],
      LatestBusTripID: null,
      CreatedBy: 'OP-2024-00123',
    },
  });
  await prisma.regularBusAssignment.create({
    data: {
      RegularBusAssignmentID: ids.busAssignmentID_NotReady,
      DriverID: driverIDs[1],
      ConductorID: conductorIDs[1],
      LatestBusTripID: null,
      CreatedBy: 'OP-2024-00123',
    },
  });
  await prisma.regularBusAssignment.create({
    data: {
      RegularBusAssignmentID: ids.busAssignmentID_InOperation,
      DriverID: driverIDs[2],
      ConductorID: conductorIDs[2],
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
      DispatchedAt: new Date('2025-07-04T10:00:00Z'),
      CompletedAt: null,
      PettyCash: 150,
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
  const regularAssignments = await prisma.regularBusAssignment.findMany({ take: 3 }); // <-- take 3

  if (regularAssignments.length < 3) {
    throw new Error('Not enough RegularBusAssignments to create QuotaPolicies.');
  }

  const quotaPolicyData = [
    {
      StartDate: new Date('2025-01-01T00:00:00Z'),
      EndDate: new Date('2025-12-31T23:59:59Z'),
      RegularBusAssignmentID: regularAssignments[0].RegularBusAssignmentID,
    },
    {
      StartDate: new Date('2025-01-01T00:00:00Z'),
      EndDate: new Date('2025-12-31T23:59:59Z'),
      RegularBusAssignmentID: regularAssignments[1].RegularBusAssignmentID,
    },
    {
      StartDate: new Date('2025-01-01T00:00:00Z'),
      EndDate: new Date('2025-12-31T23:59:59Z'),
      RegularBusAssignmentID: regularAssignments[2].RegularBusAssignmentID,
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
    { PQuotaPolicyID: quotaPolicies[2].QuotaPolicyID, Percentage: 0.5 },
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

  for (let i = 3; i < 8; i++) { // Use indices 3 to 7 (5 assignments, skip first 3)
    const busAssignmentID = await generateFormattedID('BA');
    const busID = busIDs[i];
    const driverID = driverIDs[i];
    const conductorID = conductorIDs[i];
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

    // Create QuotaPolicy for this assignment
    const quotaPolicyID = await generateFormattedID('QP');
    const rawEndDate = new Date(today.getTime() + 12 * 60 * 60 * 1000);
    // Set to end of that day
    rawEndDate.setHours(23, 59, 59, 999);

    await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: quotaPolicyID,
        StartDate: new Date(today.getTime() - 60 * 60 * 1000), // 1 hour before trip
        EndDate: rawEndDate,
        RegularBusAssignmentID: busAssignmentID,
        CreatedBy: 'OP-2024-00123',
        // The Fixed or Percentage will be created below
      }
    });
    
    // Alternate between Fixed and Percentage for demo
    if (i % 2 === 1) {
      // Fixed
      await prisma.fixed.create({
        data: {
          FQuotaPolicyID: quotaPolicyID,
          Quota: 1000 + i * 100,
          CreatedBy: 'OP-2024-00123',
        }
      });
    } else {
      // Percentage
      await prisma.percentage.create({
        data: {
          PQuotaPolicyID: quotaPolicyID,
          Percentage: 0.1 + i * 0.01,
          CreatedBy: 'OP-2024-00123',
        }
      });
    }

    // Create BusTrip (completed) for today
    const busTripID = await generateFormattedID('BT');
    const dispatchedAt = new Date(today.getTime() + (i - 1) * 60 * 60 * 1000); // 8AM, 9AM, ..., 12PM
    const completedAt = new Date(dispatchedAt.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    const sales = 1000 + i * 100;
    const pettyCash = 100 + i * 10;
    const remarks = `Completed trip for bus ${busID}`;
    const tripExpense = 200 + i * 10;

    await prisma.busTrip.create({
      data: {
        BusTripID: busTripID,
        RegularBusAssignmentID: busAssignmentID,
        DispatchedAt: dispatchedAt,
        CompletedAt: completedAt,
        Sales: sales,
        PettyCash: pettyCash,
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

  console.log('5 completed bus assignments, trips, quota policies, and ticket bus trips seeded (for today)');
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
