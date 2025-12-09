import esbuild from 'esbuild';

console.log('\n🔨 Building with esbuild...\n');

try {
  await esbuild.build({
    entryPoints: ['app.js'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: 'app.cjs',
    packages: 'external',
    logLevel: 'info',
  });

  console.log('\n✅ Build completed successfully!\n');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}