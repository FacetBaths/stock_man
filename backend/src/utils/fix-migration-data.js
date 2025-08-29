#!/usr/bin/env node

/**
 * Fix Migration Data - Correct Data Mapping Issues
 * 
 * This script fixes the migration issues where:
 * 1. Root-level fields (name, brand, model) contain wrong data
 * 2. Correct data is in the details object
 * 3. Fields were incorrectly mapped during migration
 * 
 * The script will:
 * 1. Analyze all SKUs with conflicting data
 * 2. Use details object as source of truth
 * 3. Correct root-level fields
 * 4. Clean up data structure
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class MigrationDataFixer {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;
    this.client = null;
    this.db = null;
  }

  async connect() {
    console.log('🔌 Connecting to MongoDB...');
    this.client = new MongoClient(this.mongoUri);
    await this.client.connect();
    this.db = this.client.db();
    console.log('✅ Connected to MongoDB');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  async analyzeDataIssues() {
    console.log('\n🔍 Analyzing SKU data issues...');
    
    const skus = await this.db.collection('skus').find({}).toArray();
    const issues = [];
    
    for (const sku of skus) {
      const skuIssues = {
        _id: sku._id,
        sku_code: sku.sku_code,
        issues: [],
        corrections: {}
      };
      
      // Check for conflicting name fields
      if (sku.name && sku.details?.name && sku.name !== sku.details.name) {
        skuIssues.issues.push('Conflicting name fields');
        skuIssues.corrections.name = sku.details.name; // Use details as truth
        console.log(`❌ ${sku.sku_code}: Root name="${sku.name}" vs Details name="${sku.details.name}"`);
      }
      
      // Check for conflicting brand fields
      if (sku.brand && sku.details?.brand && sku.brand !== sku.details.brand) {
        skuIssues.issues.push('Conflicting brand fields');
        skuIssues.corrections.brand = sku.details.brand; // Use details as truth
        console.log(`❌ ${sku.sku_code}: Root brand="${sku.brand}" vs Details brand="${sku.details.brand}"`);
      }
      
      // Check for conflicting model fields
      if (sku.model && sku.details?.model && sku.model !== sku.details.model) {
        skuIssues.issues.push('Conflicting model fields');
        skuIssues.corrections.model = sku.details.model; // Use details as truth
        console.log(`❌ ${sku.sku_code}: Root model="${sku.model}" vs Details model="${sku.details.model}"`);
      }
      
      // Check for conflicting description fields
      if (sku.description && sku.details?.description && sku.description !== sku.details.description && sku.details.description.trim() !== '') {
        skuIssues.issues.push('Conflicting description fields');
        skuIssues.corrections.description = sku.details.description; // Use details as truth
        console.log(`❌ ${sku.sku_code}: Root desc="${sku.description}" vs Details desc="${sku.details.description}"`);
      }
      
      if (skuIssues.issues.length > 0) {
        issues.push(skuIssues);
      }
    }
    
    console.log(`\nFound ${issues.length} SKUs with data issues`);
    return issues;
  }

  async correctSKUData(issues) {
    console.log('\n🔧 Correcting SKU data...');
    
    for (const issue of issues) {
      console.log(`\nFixing SKU: ${issue.sku_code}`);
      console.log(`Issues: ${issue.issues.join(', ')}`);
      
      const updates = {};
      
      // Apply corrections from details object to root level
      if (issue.corrections.name) {
        updates.name = issue.corrections.name;
        console.log(`  ✅ Corrected name: "${issue.corrections.name}"`);
      }
      
      if (issue.corrections.brand) {
        updates.brand = issue.corrections.brand;
        console.log(`  ✅ Corrected brand: "${issue.corrections.brand}"`);
      }
      
      if (issue.corrections.model) {
        updates.model = issue.corrections.model;
        console.log(`  ✅ Corrected model: "${issue.corrections.model}"`);
      }
      
      if (issue.corrections.description) {
        updates.description = issue.corrections.description;
        console.log(`  ✅ Corrected description: "${issue.corrections.description}"`);
      }
      
      // Add timestamp
      updates.updatedAt = new Date();
      updates.last_updated_by = 'data-fix-script';
      
      if (Object.keys(updates).length > 2) { // More than just updatedAt and last_updated_by
        await this.db.collection('skus').updateOne(
          { _id: issue._id },
          { $set: updates }
        );
        console.log(`  💾 Updated SKU ${issue.sku_code} in database`);
      }
    }
  }

  async validateCorrections() {
    console.log('\n✅ Validating corrections...');
    
    const skus = await this.db.collection('skus').find({}).toArray();
    
    console.log('\nSKU Data After Corrections:');
    console.log('==========================');
    
    for (const sku of skus) {
      console.log(`\n📦 SKU: ${sku.sku_code}`);
      console.log(`   Name: ${sku.name}`);
      console.log(`   Brand: ${sku.brand}`);
      console.log(`   Model: ${sku.model}`);
      console.log(`   Description: ${sku.description}`);
      
      if (sku.details) {
        console.log(`   Details.name: ${sku.details.name || 'N/A'}`);
        console.log(`   Details.brand: ${sku.details.brand || 'N/A'}`);
        console.log(`   Details.model: ${sku.details.model || 'N/A'}`);
        console.log(`   Details.description: ${sku.details.description || 'N/A'}`);
      }
      
      // Check if still has conflicts
      const hasConflicts = (
        (sku.name && sku.details?.name && sku.name !== sku.details.name) ||
        (sku.brand && sku.details?.brand && sku.brand !== sku.details.brand) ||
        (sku.model && sku.details?.model && sku.model !== sku.details.model)
      );
      
      if (hasConflicts) {
        console.log(`   ⚠️  Still has conflicts!`);
      } else {
        console.log(`   ✅ Data consistency OK`);
      }
    }
  }

  async checkInstanceData() {
    console.log('\n🔍 Checking instance data alignment...');
    
    const instances = await this.db.collection('instances').find({}).toArray();
    console.log(`Total instances: ${instances.length}`);
    
    // Group by SKU
    const instancesBySkU = {};
    for (const instance of instances) {
      const skuId = instance.sku_id.toString();
      if (!instancesBySkU[skuId]) {
        instancesBySkU[skuId] = [];
      }
      instancesBySkU[skuId].push(instance);
    }
    
    console.log('\nInstances per SKU:');
    for (const [skuId, instances] of Object.entries(instancesBySkU)) {
      const sku = await this.db.collection('skus').findOne({ _id: new ObjectId(skuId) });
      console.log(`${sku?.sku_code || skuId}: ${instances.length} instances`);
    }
  }

  async runFix() {
    try {
      await this.connect();
      
      console.log('🚀 Starting Migration Data Fix');
      console.log('===============================');
      
      // Stage 1: Analyze data issues
      const issues = await this.analyzeDataIssues();
      
      if (issues.length === 0) {
        console.log('\n✅ No data issues found!');
        return;
      }
      
      // Stage 2: Show what will be corrected
      console.log('\n📋 Planned Corrections:');
      for (const issue of issues) {
        console.log(`\n${issue.sku_code}:`);
        for (const [field, value] of Object.entries(issue.corrections)) {
          console.log(`  ${field}: → "${value}"`);
        }
      }
      
      // Stage 3: Apply corrections
      await this.correctSKUData(issues);
      
      // Stage 4: Validate corrections
      await this.validateCorrections();
      
      // Stage 5: Check instance data
      await this.checkInstanceData();
      
      console.log('\n🎉 Migration data fix completed!');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run fix if called directly
if (require.main === module) {
  const fixer = new MigrationDataFixer();
  fixer.runFix().catch(console.error);
}

module.exports = MigrationDataFixer;
