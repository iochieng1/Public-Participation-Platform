import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://ppp:ppp@localhost:5433/ppp_test';
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
