import { execa } from 'execa';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../src/cli/index.ts');

const runCli = async (args: string[], opts?: { env?: NodeJS.ProcessEnv }) => {
  // Run CLI using ts-node (since the CLI is TypeScript?)
  const binPath = require.resolve('ts-node/dist/bin');
  return execa('node', [binPath, CLI_PATH, ...args], {
    env: {
      ...process.env,
      ...(opts?.env || {}),
    },
    reject: false,
  });
};

describe('CLI Error Handling for Uncaught Exceptions', () => {
  it('should handle missing provider error gracefully', async () => {
    // Intentionally use a nonexistent provider
    const { stdout, stderr, exitCode } = await runCli(['explain', '--provider', 'DOESNOTEXIST', '--input', 'Some error test?']);
    expect(exitCode).not.toBe(0);
    expect(stderr + stdout).toMatch(/provider.+not found|invalid provider|unknown provider/i);
  });

  it('should handle workspace inspection failures', async () => {
    // Mock required env to force workspace inspection failure (simulate unreadable folder)
    const { stdout, stderr, exitCode } = await runCli(['explain', '--input', 'Test errors'], {
      env: { OTTILIONE_WORKSPACE: '/does/not/exist1234' },
    });
    // It may still continue, but should report workspace inspect error
    expect(stderr + stdout).toMatch(/workspace|inspect|error|ENOENT/i);
  });

  it('should handle analytics post failures', async () => {
    // Simulate analytics URL is broken
    const { stdout, stderr } = await runCli(['explain', '--input', 'Test analytics error'], {
      env: {
        OTTILIONE_ANALYTICS_URL: 'https://127.0.0.1:9999/fake',
        OTTILIONE_ANALYTICS_ENABLED: '1',
      },
    });
    expect(stderr + stdout).toMatch(/analytics|post|error|ECONNREFUSED|EAI_AGAIN/i);
  });

  it('should show help/error for bad CLI command', async () => {
    const { stdout, stderr, exitCode } = await runCli(['notacommand', '--whatevs']);
    expect(exitCode).not.toBe(0);
    expect(stderr + stdout).toMatch(/unknown command|not recognized|invalid|help/i);
  });
});
