---
description: Seamlessly migrate your data from Phoenix to Arize AX
---

# Phoenix to Arize AX Migration

## Overview

This migration tool helps you move your data from Phoenix to Arize AX in just a few simple steps. It transfers:

* 📊 **Projects and Traces** - Your observability data
* 📝 **Annotations** -  Feedback data
* 🎯 **Datasets** - Training and test data
* 🤖 **Prompts** - Prompt templates
* 📈 **Evaluations** - Performance metrics

{% hint style="info" %}
The migration happens in two steps: first export from Phoenix, then import to Arize AX.
{% endhint %}

## What You Need

* Access to your Phoenix instance
* An Arize AX Pro account
* Python installed on your computer

## Getting Started

### Step 1: Download the Migration Tool

```bash
git clone https://github.com/Dylancouzon/phoenix2ax
cd phoenix2ax
pip install -r requirements.txt
```

**Note:** This migration tool was created by an Arize team member for the community, but it is **not an official Arize package**.

### Step 2: Configure Your Settings

1.  Copy the example configuration file:

    ```bash
    cp .env.example .env
    ```
2.  Edit the `.env` file with your details:

    ```bash
    # Your Phoenix instance
    PHOENIX_ENDPOINT=https://your-phoenix-instance.com
    PHOENIX_API_KEY=your-phoenix-api-key

    # Your Arize AX account  
    ARIZE_API_KEY=your-arize-api-key
    ARIZE_SPACE_ID=your-arize-space-id
    ```

{% hint style="info" %}
You can find your Arize API key and Space ID in your Arize AX account settings.
{% endhint %}

### Step 3: Export Your Data from Phoenix

Run this command to export all your data:

```bash
python export_all_projects.py --all
```

This creates a `phoenix_export` folder with all your data.

### Step 4: Import Your Data to Arize AX

Run this command to import everything:

```bash
python import_to_arize.py --all
```

{% hint style="warning" %}
The import process will guide you through setting up annotations. Follow the prompts carefully.
{% endhint %}

## Common Options

### Export Specific Projects Only

If you only want certain projects:

```bash
python export_all_projects.py --all --project "my-important-project"
```

### Export Specific Data Types

If you only need certain types of data:

```bash
# Just datasets and prompts
python export_all_projects.py --datasets --prompts

# Just traces
python export_all_projects.py --traces
```

### Get More Details

Add `--verbose` to see detailed progress:

```bash
python export_all_projects.py --all --verbose
python import_to_arize.py --all --verbose
```

## What Gets Created

After export, you'll see this structure:

```
phoenix_export/
├── datasets/          # Your datasets
├── prompts/           # Your prompt templates  
└── projects/          # Your projects and traces
    ├── project-1/
    └── project-2/
```

After import, check the `results/` folder for detailed logs.

## Troubleshooting

### "Authentication failed"

* Double-check your API keys in the `.env` file
* Make sure your keys have the right permissions

### "Connection timeout"

* Check your internet connection
* Try exporting one project at a time for large datasets

### Import issues with annotations

* Run the annotation setup first: `python import_to_arize.py --annotations`
* Follow the setup guide in your Arize AX interface
* Then re-run the full import

### Getting more help

* Use `--verbose` for detailed logs
* Check the `results/` folder for error details
* Visit the [GitHub repository](https://github.com/Dylancouzon/phoenix2ax) for issues

## Important Notes

### For Annotations

Annotations require special setup:

1. Run: `python import_to_arize.py --annotations`
2. Configure annotation types in Arize AX (follow the prompts)
3. Re-run the import after setup

### For Large Datasets

If you have lots of data:

* Export one project at a time
* Use `--verbose` to monitor progress
* Be patient - large imports can take time

### Data Safety

* Your original Phoenix data stays unchanged
* You can re-run commands safely (duplicates are skipped)
* All data transfers are encrypted

## Next Steps

After migration:

1. ✅ Check your data in Arize AX
2. ✅ Verify key projects and datasets
3. ✅ Test annotations and evaluations
4. ✅ Set up your team's access in Arize AX

***

{% hint style="success" %}
🎉 Congratulations! Your Phoenix data is now available in Arize AX with all relationships preserved.
{% endhint %}

## Need More Help?

* **Detailed documentation**: Check the [GitHub repository](https://github.com/Dylancouzon/phoenix2ax)
* **Report issues**: [GitHub Issues](https://github.com/Dylancouzon/phoenix2ax/issues)
* **Arize support**: [Arize Documentation](https://docs.arize.com)
