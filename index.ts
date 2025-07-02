import { AutoScalingClient, SetDesiredCapacityCommand, DescribeAutoScalingInstancesCommand, TerminateInstanceInAutoScalingGroupCommand } from "@aws-sdk/client-auto-scaling";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

import dotenv from 'dotenv';
import express from "express"

dotenv.config();
const app = express();

app.use(express.json());

if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
    throw new Error('AWS credentials are missing');
}

const client = new AutoScalingClient({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

const ec2Client = new EC2Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

type Machine = {
    ip: string;
    isUsed: boolean;
    assignedProject?: string
}

const ALL_MACHINES: Machine[] = []

async function refreshInstances() {
    try {
        console.log('Refreshing instances...');
        const command = new DescribeAutoScalingInstancesCommand()
        const data = await client.send(command)

        if (!data.AutoScalingInstances || data.AutoScalingInstances.length === 0) {
            console.log('No instances found in Auto Scaling Group');
            // Clear ALL_MACHINES if no instances exist
            ALL_MACHINES.length = 0;
            return;
        }

        const instanceIds = data.AutoScalingInstances
            .map(x => x.InstanceId)
            .filter((id): id is string => id !== undefined);

        if (instanceIds.length === 0) {
            console.log('No valid instance IDs found');
            return;
        }

        const EC2InstanceCommand = new DescribeInstancesCommand({
            InstanceIds: instanceIds
        })

        const EC2Response = await ec2Client.send(EC2InstanceCommand);

        // Preserve existing machine states before updating
        const existingMachines = [...ALL_MACHINES]; // Make a copy

        // Clear and repopulate ALL_MACHINES with current running instances
        ALL_MACHINES.length = 0;

        EC2Response.Reservations?.forEach(reservation => {
            reservation.Instances?.forEach(instance => {
                if (instance.State?.Name === 'running' && instance.PublicIpAddress) {
                    // Check if machine already exists to preserve isUsed status
                    const existingMachine = existingMachines.find(m => m.ip === instance.PublicIpAddress);

                    ALL_MACHINES.push({
                        ip: instance.PublicIpAddress,
                        isUsed: existingMachine?.isUsed || false,
                        assignedProject: existingMachine?.assignedProject
                    });
                }
            });
        });

        console.log(`Found ${ALL_MACHINES.length} running machines`);
        console.log(`Idle machines: ${ALL_MACHINES.filter(x => !x.isUsed).length}`);
        console.log(`Used machines: ${ALL_MACHINES.filter(x => x.isUsed).length}`);

    } catch (error) {
        console.error('Error refreshing instances:', error);
    }
}

refreshInstances()

setInterval(() => {
    refreshInstances()
}, 10 * 1000)

app.get("/:projectId", async (req, res) => {
    try {
        const { projectId } = req.params;

        const idleMachine = ALL_MACHINES.find(x => x.isUsed === false);
        if (!idleMachine) {
            res.status(400).send("No idle machine found")
            return
        }

        idleMachine.isUsed = true;
        idleMachine.assignedProject = projectId;

        // Scale up the infrastructure to maintain buffer of idle machines
        const idleMachinesCount = ALL_MACHINES.filter(x => x.isUsed === false).length;
        const desiredCapacity = ALL_MACHINES.length + Math.max(0, 5 - idleMachinesCount);

        console.log(`Current machines: ${ALL_MACHINES.length}, Idle: ${idleMachinesCount}, Scaling to: ${desiredCapacity}`);

        const command = new SetDesiredCapacityCommand({
            AutoScalingGroupName: "vscode-asg",
            DesiredCapacity: desiredCapacity
        });

        // Actually execute the scaling command
        await client.send(command);
        console.log(`Scaled Auto Scaling Group to ${desiredCapacity} instances`);

        res.send({
            ip: idleMachine.ip,
            projectId: projectId
        })
    } catch (error) {
        console.error('Error in project allocation:', error);
        res.status(500).send("Internal server error");
    }
})

app.post("/destroy", async (req, res) => {
    try {
        const machineId: string = req.body.machineId;

        if (!machineId) {
            res.status(400).send("Machine ID is required");
            return
        }

        const command = new TerminateInstanceInAutoScalingGroupCommand({
            InstanceId: machineId,
            ShouldDecrementDesiredCapacity: true
        });

        await client.send(command);
        console.log(`Destroyed machine ${machineId}`);

        res.send({ success: true, message: `Machine ${machineId} destroyed` });
    } catch (error) {
        console.error('Error destroying machine:', error);
        res.status(500).send("Failed to destroy machine");
    }
});

// Health/Status endpoint for monitoring
app.get("/status", (req, res) => {
    res.json({
        totalMachines: ALL_MACHINES.length,
        idleMachines: ALL_MACHINES.filter(x => !x.isUsed).length,
        usedMachines: ALL_MACHINES.filter(x => x.isUsed).length,
        machines: ALL_MACHINES.map(m => ({
            ip: m.ip,
            isUsed: m.isUsed,
            assignedProject: m.assignedProject
        }))
    });
});

app.listen(9092, () => {
    console.log('AWS Orchestrator running on port 9092');
    console.log('Endpoints:');
    console.log('  GET /:projectId - Allocate machine to project');
    console.log('  POST /destroy - Destroy specific machine');
    console.log('  GET /status - View current machines status');
})




