import { Activity, Team, User, Workout } from '../models/index.js';
import { isValidObjectId, Types } from 'mongoose';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Invalid activity input'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as {
    userId?: unknown;
    teamId?: unknown;
    type?: unknown;
    minutes?: unknown;
  };

  if (
    typeof userId !== 'string' ||
    typeof teamId !== 'string' ||
    !isValidObjectId(userId) ||
    !isValidObjectId(teamId) ||
    typeof type !== 'string' ||
    type.trim().length === 0 ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw Object.assign(new Error('Invalid activity input'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.exists({ _id: new Types.ObjectId(userId) }),
    Team.exists({ _id: new Types.ObjectId(teamId) }),
  ]);

  if (!user || !team) {
    throw Object.assign(new Error('User or team does not exist'), { status: 400 });
  }

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Invalid team input'), { status: 400 });
  }

  const { name, mascot, members = [] } = input as {
    name?: unknown;
    mascot?: unknown;
    members?: unknown;
  };

  if (
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    typeof mascot !== 'string' ||
    mascot.trim().length === 0 ||
    !Array.isArray(members) ||
    members.some((member) => typeof member !== 'string' || !isValidObjectId(member))
  ) {
    throw Object.assign(new Error('Invalid team input'), { status: 400 });
  }

  const memberIds = members.map((member) => new Types.ObjectId(member));
  if (memberIds.length > 0) {
    const memberCount = await User.countDocuments({ _id: { $in: memberIds } });
    if (memberCount !== memberIds.length) {
      throw Object.assign(new Error('One or more team members do not exist'), { status: 400 });
    }
  }

  const team = await Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: memberIds,
  });

  if (memberIds.length > 0) {
    await User.updateMany({ _id: { $in: memberIds } }, { $set: { team: team._id } });
  }

  return team;
}

export async function getLeaderboard() {
  const entries = await Activity.aggregate<{
    teamId: Types.ObjectId;
    totalPoints: number;
  }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $project: { _id: 0, teamId: '$_id', totalPoints: 1 } },
    { $sort: { totalPoints: -1 } },
  ]);

  const teams = await Team.find({
    _id: { $in: entries.map((entry) => entry.teamId) },
  }).lean();
  const teamsById = new Map(teams.map((team) => [team._id.toString(), team]));

  return entries.flatMap((entry, index) => {
    const team = teamsById.get(entry.teamId.toString());
    return team ? [{
      teamId: team._id.toString(),
      teamName: team.name,
      totalPoints: entry.totalPoints,
      rank: index + 1,
    }] : [];
  });
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User does not exist'), { status: 404 });
  }

  const activityType = await Activity.findOne({ user: user._id })
    .sort({ occurredAt: -1 })
    .lean();

  const normalizedType = activityType?.type?.toLowerCase() ?? '';
  const focus = normalizedType === 'strength'
    ? 'strength'
    : normalizedType === 'run' || normalizedType === 'cycle'
      ? 'endurance'
      : user.fitnessGoal;

  const workout = await Workout.findOne({ focus }).lean();
  if (!workout) {
    throw Object.assign(new Error('No matching workout found'), { status: 404 });
  }

  return [{
    ...workout,
    reason: activityType
      ? `Matches your recent ${activityType.type} activity and ${focus} focus`
      : `Matches your ${focus} fitness goal`,
  }];
}

export { User };
