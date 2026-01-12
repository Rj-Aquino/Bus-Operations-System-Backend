import { BusOperationStatus , PrismaClient, ToolSourceType, DamageReportStatus, RentalRequestStatus  } from '@prisma/client';
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
  '5', '6', '8', '9', '11',
  '12', '14', '15', '17', '18',
  '20', '21', '23', '24'
];

const driverIDs = [
  "EMP-2021-OPS-007",
  "EMP-2026-OPS-006",
  "EMP-2024-OPS-008",
  "EMP-2019-OPS-009",
  "EMP-2018-OPS-010",
  "EMP-2024-OPS-003",
  "EMP-2020-OPS-005",
];

const conductorIDs = [
 "EMP-2020-OPS-011",
  "EMP-2022-OPS-012",
  "EMP-2019-OPS-013",
  "EMP-2025-OPS-015",
  "EMP-2026-OPS-014",
  "EMP-2026-OPS-018",
  "EMP-2019-OPS-017",
  "EMP-2024-OPS-016",
  "EMP-2026-OPS-019",
  "EMP-2019-OPS-020"
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
  const types = [{ Value: 10.0 }, { Value: 15.0 }, { Value: 20.0 }, { Value: 30.0 }, { Value: 50.0 }, { Value: 100.0 }];
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
        Brake: a.allChecks,
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
      StartDate: new Date('2026-01-01T00:00:00Z'),
      EndDate: new Date('2026-12-31T23:59:59Z'),
      RegularBusAssignmentID: regularAssignments[0].RegularBusAssignmentID,
    },
    {
      StartDate: new Date('2026-01-01T00:00:00Z'),
      EndDate: new Date('2026-12-31T23:59:59Z'),
      RegularBusAssignmentID: regularAssignments[1].RegularBusAssignmentID,
    },
    {
      StartDate: new Date('2026-01-01T00:00:00Z'),
      EndDate: new Date('2026-12-31T23:59:59Z'),
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

  // Use a range of dates for completed trips
  const baseDate = new Date();
  baseDate.setHours(8, 0, 0, 0); // 8:00 AM today

  for (let i = 3; i < 13; i++) { // 10 assignments

    const busAssignmentID = await generateFormattedID('BA');
    const busID = busIDs[i % busIDs.length];
    const driverID = driverIDs[i % driverIDs.length];
    const conductorID = conductorIDs[i % conductorIDs.length];
    const route = routes[i % routes.length];

    // Create BusAssignment
    await prisma.busAssignment.create({
      data: {
        BusAssignmentID: busAssignmentID,
        BusID: busID,
        RouteID: route.RouteID,
        Battery: false,
        Lights: false,
        Oil: false,
        Water: false,
        Brake: false,
        Air: false,
        Gas: false,
        Engine: false,
        TireCondition: false,
        Self_Driver: false,
        Self_Conductor: false,
        IsDeleted: false,
        Status: BusOperationStatus.NotReady,
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

    const daysAgo = 9 - (i - 3); // 9,8,...,0
    const dispatchedAt = new Date(baseDate);
    dispatchedAt.setDate(baseDate.getDate() - daysAgo);
    dispatchedAt.setHours(8 + (i % 5), 0, 0, 0); // 8AM-12PM
    const completedAt = new Date(dispatchedAt.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    // QuotaPolicy: start the day before dispatchedAt, end the day after completedAt
    const quotaPolicyStart = new Date(dispatchedAt);
    quotaPolicyStart.setDate(quotaPolicyStart.getDate() - 1);
    quotaPolicyStart.setHours(0, 0, 0, 0);

    const quotaPolicyEnd = new Date(completedAt);
    quotaPolicyEnd.setDate(quotaPolicyEnd.getDate() + 1);
    quotaPolicyEnd.setHours(23, 59, 59, 999);

    // Create QuotaPolicy for this assignment
    const quotaPolicyID = await generateFormattedID('QP');
    await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: quotaPolicyID,
        StartDate: quotaPolicyStart,
        EndDate: quotaPolicyEnd,
        RegularBusAssignmentID: busAssignmentID,
        CreatedBy: 'OP-2024-00123',
      }
    });

    // Alternate between Fixed and Percentage for demo
    if (i % 2 === 1) {
      await prisma.fixed.create({
        data: {
          FQuotaPolicyID: quotaPolicyID,
          Quota: 1000 + i * 100,
          CreatedBy: 'OP-2024-00123',
        }
      });
    } else {
      await prisma.percentage.create({
        data: {
          PQuotaPolicyID: quotaPolicyID,
          Percentage: 0.1 + i * 0.01,
          CreatedBy: 'OP-2024-00123',
        }
      });
    }

    // Create BusTrip (completed) with different dates
    const busTripID = await generateFormattedID('BT');
    const sales = 1000 + i * 100;
    const pettyCash = 100 + i * 10;
    const remarks = `Completed trip for bus ${busID}`;
    const tripExpense = 200 + i * 10;
    const paymentMethod = i % 2 === 0 ? 'Reimbursement' : 'Company_Cash';

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
        Payment_Method: paymentMethod,
        CreatedBy: 'OP-2024-00123',
      },
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

  console.log('10 completed bus assignments, trips, quota policies, and ticket bus trips seeded (with varied dates)');
}

async function seedRentalBusAssignments() {
  const allRoutes = await prisma.route.findMany({ orderBy: { RouteID: 'asc' } });
  const routeID1 = allRoutes[0]?.RouteID;
  const routeID2 = allRoutes[1]?.RouteID;

  const ids = {
    rental1: await generateFormattedID('BA'),
    rental2: await generateFormattedID('BA'),
    rental3: await generateFormattedID('BA'),
  };

  const rentals = [
    {
      id: ids.rental1,
      busID: busIDs[9],
      routeID: routeID1,
      status: BusOperationStatus.NotStarted,
      allChecks: true,
      note: 'All systems checked and verified, no damages found.',
      driverIDs: [driverIDs[0], driverIDs[1]], 
    },
    {
      id: ids.rental2,
      busID: busIDs[12],
      routeID: routeID2,
      status: BusOperationStatus.NotReady,
      allChecks: false,
      note: 'Minor oil leakage detected during inspection.',
      driverIDs: [driverIDs[2], driverIDs[3]],
    },
    {
      id: ids.rental3,
      busID: busIDs[13],
      routeID: routeID1,
      status: BusOperationStatus.InOperation,
      allChecks: true,
      note: null,
      driverIDs: [driverIDs[4], driverIDs[5]],
    },
  ];

  for (const r of rentals) {
    // Step 1: Create BusAssignment
    await prisma.busAssignment.create({
      data: {
        BusAssignmentID: r.id,
        BusID: r.busID,
        RouteID: r.routeID,
        AssignmentType: 'Rental',
        Battery: r.allChecks,
        Lights: r.allChecks,
        Oil: r.allChecks,
        Water: r.allChecks,
        Brake: r.allChecks,
        Air: r.allChecks,
        Gas: r.allChecks,
        Engine: r.allChecks,
        TireCondition: r.allChecks,
        Self_Driver: r.allChecks,
        Self_Conductor: r.allChecks,
        IsDeleted: false,
        Status: r.status,
        CreatedBy: 'OP-2024-00123',
      },
    });

    // Step 2: Create RentalBusAssignment
    await prisma.rentalBusAssignment.create({
      data: {
        RentalBusAssignmentID: r.id,
        CreatedBy: 'OP-2024-00123',
      },
    });

    // Step 3: Create two RentalDrivers for each rental
    for (const driverID of r.driverIDs) {
      await prisma.rentalDriver.create({
        data: {
          RentalDriverID: await generateFormattedID('RD'),
          RentalBusAssignmentID: r.id,
          DriverID: driverID,
          CreatedBy: 'OP-2024-00123',
        },
      });
    }
  }

  console.log('✅ Rental bus assignments (each with 2 drivers) seeded successfully');
  return ids;
}

async function seedRentalDrivers(rentalIDs: { [key: string]: string }) {
  const drivers = [
    {
      id: await generateFormattedID('RD'),
      rentalBusAssignmentID: rentalIDs.rental1,
      driverID: driverIDs[4],
    },
    {
      id: await generateFormattedID('RD'),
      rentalBusAssignmentID: rentalIDs.rental2,
      driverID: driverIDs[5],
    },
    {
      id: await generateFormattedID('RD'),
      rentalBusAssignmentID: rentalIDs.rental3,
      driverID: driverIDs[6],
    },
  ];

  for (const d of drivers) {
    await prisma.rentalDriver.create({
      data: {
        RentalDriverID: d.id,
        RentalBusAssignmentID: d.rentalBusAssignmentID,
        DriverID: d.driverID,
        CreatedBy: 'OP-2024-00123',
      },
    });
  }

  console.log('Rental drivers seeded');
}

async function seedRentalRequests(rentalIDs: { [key: string]: string }) {
  const requests = [
    {
      id: await generateFormattedID('RR'),
      rentalBusAssignmentID: rentalIDs.rental1,
      routeName: 'QC → Makati',

      pickupLat: '14.6760',
      pickupLng: '121.0437',
      dropoffLat: '14.5547',
      dropoffLng: '121.0244',

      distanceKM: 12.5,
      rentalPrice: 3500.0,
      passengers: 20,
      rentalDate: new Date('2026-01-01'),
      durationDays: 1,
      requirements: 'Air conditioning required',

      customer: 'Juan Dela Cruz',
      contact: '09171234567',
      email: 'juan.delacruz@example.com',

      idType: 'Driver License',
      idNumber: 'DL-123456789',
      homeAddress: 'Quezon City, Philippines',
      idImage: 'https://res.cloudinary.com/dt0hdz5y5/image/upload/c_limit,w_800/q_auto/f_auto/v1/rental-ids/j2e6yvtqzqnesurs4e64?_a=BAMAABfm0',

      status: RentalRequestStatus.Approved,
      downPayment: 1000,
      fullPaymentDate: new Date('2025-12-30'),
    },
    {
      id: await generateFormattedID('RR'),
      rentalBusAssignmentID: rentalIDs.rental2,
      routeName: 'Pasay → Tagaytay',

      pickupLat: '14.5567',
      pickupLng: '121.0244',
      dropoffLat: '14.0961',
      dropoffLng: '121.2400',

      distanceKM: 60.0,
      rentalPrice: 8500.0,
      passengers: 40,
      rentalDate: new Date('2026-01-7'),
      durationDays: 2,
      requirements: 'Reclining seats',

      customer: 'Maria Santos',
      contact: '09182345678',
      email: 'maria.santos@example.com',
      idType: 'Driver License',
      idNumber: 'P1234567',
      homeAddress: 'Pasay City, Philippines',
      idImage: 'https://res.cloudinary.com/dt0hdz5y5/image/upload/c_limit,w_800/q_auto/f_auto/v1/rental-ids/j2e6yvtqzqnesurs4e64?_a=BAMAABfm0',

      status: RentalRequestStatus.Pending,
      downPayment: null,
      fullPaymentDate: null,
    },
    {
      id: await generateFormattedID('RR'),
      rentalBusAssignmentID: rentalIDs.rental3,
      routeName: 'Manila → Batangas Port',

      pickupLat: '14.5995',
      pickupLng: '120.9842',
      dropoffLat: '13.7563',
      dropoffLng: '121.0583',

      distanceKM: 100.0,
      rentalPrice: 12500.0,
      passengers: 30,
      rentalDate: new Date('2026-01-10'),
      durationDays: 1,
      requirements: null,

      customer: 'Pedro Reyes',
      contact: '09193456789',
      email: 'pedro.reyes@example.com',

      idType: 'Passport',
      idNumber: 'Passport A12345678',
      homeAddress: 'Manila, Philippines',
      idImage: 'https://res.cloudinary.com/dt0hdz5y5/image/upload/c_limit,w_800/q_auto/f_auto/v1/rental-ids/t36fqstoxmtu7ldyoqpt?_a=BAMAABfm0',

      status: RentalRequestStatus.Completed,
      downPayment: 5000,
      fullPaymentDate: new Date('2026-01-07'),
    },
  ];

  for (const r of requests) {
    await prisma.rentalRequest.create({
      data: {
        RentalRequestID: r.id,
        RentalBusAssignmentID: r.rentalBusAssignmentID,

        RouteName: r.routeName,
        Pickuplatitude: r.pickupLat,
        Pickuplongitude: r.pickupLng,
        Dropofflatitude: r.dropoffLat,
        Dropofflongitude: r.dropoffLng,

        DistanceKM: r.distanceKM,
        NumberOfPassengers: r.passengers,
        RentalDate: r.rentalDate,
        Duration: r.durationDays,

        SpecialRequirements: r.requirements,
        Status: r.status,

        CustomerName: r.customer,
        CustomerContact: r.contact,
        CustomerEmail: r.email,

        IDType: r.idType,
        IDNumber: r.idNumber,
        HomeAddress: r.homeAddress,
        IDImage: r.idImage,

        TotalRentalAmount: r.rentalPrice,
        DownPaymentAmount: r.downPayment,
        BalanceAmount: r.downPayment ? r.rentalPrice - r.downPayment : null,
        DownPaymentDate: r.downPayment ? r.rentalDate : null,
        FullPaymentDate: r.fullPaymentDate,

        CancelledAtDate: null,
        CancelledReason: null,

        CreatedBy: 'OP-2024-00123',
        UpdatedBy: null,
      },
    });
  }

  console.log('✅ Rental requests seeded successfully (new schema)');
}

async function seedDamageReports(busAssignments: { 
  busAssignmentID_NotStarted: string, 
  busAssignmentID_NotReady: string, 
  busAssignmentID_InOperation: string 
}) {

  const statuses: DamageReportStatus[] = [
    DamageReportStatus.NA,
    DamageReportStatus.Pending,
    DamageReportStatus.Accepted,
    DamageReportStatus.Rejected,
  ];

  const damageReportIDs: string[] = [];

  const assignments = [
    { id: busAssignments.busAssignmentID_NotReady, name: 'NotReady', allDamages: true },
    { id: busAssignments.busAssignmentID_NotStarted, name: 'NotStarted', allDamages: false },
    { id: busAssignments.busAssignmentID_InOperation, name: 'InOperation', allDamages: false }, // use pattern for InOperation
  ];

  for (const assignment of assignments) {
    for (let i = 0; i < statuses.length; i++) {
      const damageReportID = await generateFormattedID('DR');

      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i); // Spread reports over past days

      const data = {
        DamageReportID: damageReportID,
        BusAssignmentID: assignment.id,

        Battery: assignment.allDamages === null ? i % 2 === 0 : assignment.allDamages,
        Lights: assignment.allDamages === null ? i % 3 === 0 : assignment.allDamages,
        Oil: assignment.allDamages === null ? i % 2 !== 0 : assignment.allDamages,
        Water: assignment.allDamages === null ? true : assignment.allDamages,
        Brake: assignment.allDamages === null ? false : assignment.allDamages,
        Air: assignment.allDamages === null ? true : assignment.allDamages,
        Gas: assignment.allDamages === null ? true : assignment.allDamages,
        Engine: assignment.allDamages === null ? i % 2 === 0 : assignment.allDamages,
        TireCondition: assignment.allDamages === null ? i % 3 !== 0 : assignment.allDamages,

        Note: `Sample damage report for ${assignment.name} BusAssignment with status ${statuses[i]}`,
        Status: statuses[i],

        CheckDate: checkDate, // ✅ spread timestamp
        CreatedBy: 'OP-2024-00123',
      };

      await prisma.damageReport.create({ data });

      if (assignment.name === 'NotReady') {
        damageReportIDs.push(damageReportID);
      }
    }
  }

  console.log(`✅ DamageReports seeded for all BusAssignment statuses: ${damageReportIDs.length}`);
  return damageReportIDs; // return IDs for later use (e.g., for MaintenanceWork/Tasks)
}

async function seedMaintenanceWork(damageReportIDs: string[]) {
  if (damageReportIDs.length === 0) {
    console.log('No DamageReports to create MaintenanceWork for.');
    return [];
  }

  const maintenanceStatuses = ['Pending', 'InProgress', 'Completed', 'Cancelled'] as const;
  const maintenancePriorities = ['Low', 'Medium', 'High', 'Critical'] as const;

  const maintenanceWorkIDs: string[] = [];

  for (let i = 0; i < damageReportIDs.length; i++) {
    const damageReportID = damageReportIDs[i];
    const maintenanceWorkID = await generateFormattedID('MW');

    const status = maintenanceStatuses[i % maintenanceStatuses.length];
    const priority = maintenancePriorities[i % maintenancePriorities.length];

    // Dates: Scheduled today, Due in i+1 days, Completed only if status is Completed
    const scheduledDate = new Date();
    const dueDate = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000);
    const completedDate = status === 'Completed' ? new Date(Date.now() + (i + 2) * 24 * 60 * 60 * 1000) : null;

    // Costs: estimated and actual
    const estimatedCost = 500 + i * 100;
    const actualCost = status === 'Completed' ? estimatedCost * (0.9 + Math.random() * 0.2) : null;

    await prisma.maintenanceWork.create({
      data: {
        MaintenanceWorkID: maintenanceWorkID,
        DamageReportID: damageReportID,
        Status: status,
        Priority: priority,
        WorkTitle: `Maintenance for DamageReport ${damageReportID} - ${priority} Priority`,
        ScheduledDate: scheduledDate,
        DueDate: dueDate,
        CompletedDate: completedDate,
        EstimatedCost: estimatedCost,
        ActualCost: actualCost,
        WorkNotes: `This maintenance is ${status}. Priority: ${priority}. Scheduled for ${scheduledDate.toDateString()}, due by ${dueDate.toDateString()}.`,
        CreatedBy: 'OP-2024-00123',
      },
    });

    maintenanceWorkIDs.push(maintenanceWorkID);
  }

  console.log(`✅ MaintenanceWork seeded for ${maintenanceWorkIDs.length} DamageReports with varied details`);
  return maintenanceWorkIDs;
}

async function seedTasks(maintenanceWorkIDs: string[]) {
  if (maintenanceWorkIDs.length === 0) {
    console.log('No MaintenanceWork records to create Tasks for.');
    return [];
  }

  const taskStatuses = ['Pending', 'InProgress', 'Completed'] as const;
  const taskTypes = ['Inspection', 'Repair', 'Replacement', 'Cleaning', 'Testing', 'Documentation', 'Other'] as const;

  const tasksCreated: string[] = [];

  for (let i = 0; i < maintenanceWorkIDs.length; i++) {
    const maintenanceWorkID = maintenanceWorkIDs[i];

    // Create 3 tasks per maintenance work as an example
    for (let j = 0; j < 3; j++) {
      const taskID = await generateFormattedID('TSK');
      const status = taskStatuses[(i + j) % taskStatuses.length];
      const type = taskTypes[(i + j) % taskTypes.length];

      // Dates: start today + j days, completed only if status is Completed
      const startDate = new Date(Date.now() + j * 24 * 60 * 60 * 1000);
      const completedDate = status === 'Completed' ? new Date(Date.now() + (j + 1) * 24 * 60 * 60 * 1000) : null;

      // Hours: estimated and actual
      const estimatedHours = 1 + Math.random() * 3;
      const actualHours = status === 'Completed' ? estimatedHours * (0.8 + Math.random() * 0.4) : null;

      await prisma.task.create({
        data: {
          TaskID: taskID,
          MaintenanceWorkID: maintenanceWorkID,
          TaskName: `${type} Task for Maintenance ${maintenanceWorkID}`,
          TaskType: type,
          TaskDescription: `This is a sample ${type} task with status ${status}.`,
          AssignedTo: `Mechanic-${(i + j) % 5 + 1}`,
          Status: status,
          StartDate: startDate,
          CompletedDate: completedDate,
          EstimatedHours: estimatedHours,
          ActualHours: actualHours,
          Notes: `Task generated for seeding purposes. Status: ${status}, Estimated Hours: ${estimatedHours.toFixed(2)}`,
          CreatedBy: 'OP-2024-00123',
        },
      });

      tasksCreated.push(taskID);
    }
  }

  console.log(`✅ Tasks seeded: ${tasksCreated.length}`);
  return tasksCreated;
}

async function seedTaskTools(taskIDs: string[]) {
  if (taskIDs.length === 0) throw new Error("No tasks found to attach tools.");

  const units = ["pcs", "liters", "kg", "meters"];
  const toolSourceTypes = [
    ToolSourceType.FromInventory,
    ToolSourceType.PurchasedExternally
  ];
  const toolIDs = [null, "TL-001", "TL-002", "TL-003"]; // example ToolIDs (can be null)

  for (const taskID of taskIDs) {
    // Seed 2-3 tools per task
    const numberOfTools = Math.floor(Math.random() * 2) + 2;

    for (let i = 0; i < numberOfTools; i++) {
      const taskToolID = await generateFormattedID("TSKT"); // e.g., TT-001
      const quantity = parseFloat((Math.random() * 10 + 1).toFixed(2));
      const costPerUnit = parseFloat((Math.random() * 50 + 10).toFixed(2));

      await prisma.taskTool.create({
        data: {
          TaskToolID: taskToolID,
          TaskID: taskID,
          ToolID: toolIDs[i % toolIDs.length],
          QuantityUsed: quantity,
          Unit: units[i % units.length],
          SourceType: toolSourceTypes[i % toolSourceTypes.length],
          CostPerUnit: costPerUnit,
          TotalCost: parseFloat((quantity * costPerUnit).toFixed(2)),
          Notes: `Sample tool usage for Task ${taskID}`,
          CreatedBy: "OP-2024-00123",
        },
      });
    }
  }

  console.log(`✅ TaskTools seeded for all tasks.`);
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
  //await seedCompletedBusAssignments();
 
  const rentalIDs = await seedRentalBusAssignments();

  await seedRentalDrivers(rentalIDs);
  await seedRentalRequests(rentalIDs);
  
  // Seed damage reports, maintenance works, and tasks
  const DamageReportIDs = await seedDamageReports(ids);
  const maintenanceWorkIDsWithDetails = await seedMaintenanceWork(DamageReportIDs);
  const taskids = await seedTasks(maintenanceWorkIDsWithDetails);
  await seedTaskTools(taskids);

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

