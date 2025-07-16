import { HallucinationDataset } from './dataset';
import { HallucinationBenchmark } from './benchmark';

async function main() {
  console.log('🚀 Starting Hallucination Evaluator Benchmark');
  
  try {
    const dataset = new HallucinationDataset();
    
    console.log('📊 Setting up dataset in Phoenix...');
    const datasetId = await dataset.ensureDatasetExists('hallucination-benchmark');
    
    console.log('🧠 Initializing hallucination evaluator...');
    const benchmark = new HallucinationBenchmark();
    await benchmark.initialize();
    
    console.log('⚡ Running benchmark...');
    const summary = await benchmark.runBenchmark();
    
    benchmark.printSummary(summary);
    
    console.log('\n✅ Benchmark completed successfully!');
    console.log(`📈 Dataset ID: ${datasetId}`);
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { HallucinationDataset, HallucinationBenchmark };