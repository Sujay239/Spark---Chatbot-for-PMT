import csv
import json
import os
import sys
import argparse

def extract_questions_to_js(
    csv_file_path: str,
    output_file_path: str,
    target_column: str = "Question",
    deduplicate: bool = True
):
    if not os.path.exists(csv_file_path):
        print(f"Error: Input file '{csv_file_path}' does not exist.")
        sys.exit(1)

    questions = []
    seen = set()

    # Try utf-8-sig first to gracefully handle BOM if present (e.g., from Excel)
    encodings_to_try = ["utf-8-sig", "utf-8", "latin-1"]
    reader = None

    for enc in encodings_to_try:
        try:
            with open(csv_file_path, mode="r", encoding=enc) as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                if not headers:
                    continue

                # Find column matching target_column (case-insensitive)
                matched_col = None
                for col in headers:
                    if col and col.strip().lower() == target_column.strip().lower():
                        matched_col = col
                        break

                if not matched_col:
                    print(f"Error: Column matching '{target_column}' not found. Available columns: {headers}")
                    sys.exit(1)

                for row in reader:
                    val = row.get(matched_col)
                    if val is not None:
                        val_cleaned = val.strip()
                        if val_cleaned:
                            if deduplicate:
                                if val_cleaned not in seen:
                                    seen.add(val_cleaned)
                                    questions.append(val_cleaned)
                            else:
                                questions.append(val_cleaned)
            break
        except UnicodeDecodeError:
            continue

    if reader is None:
        print(f"Error: Could not decode '{csv_file_path}' with supported encodings.")
        sys.exit(1)

    # Format into JavaScript array syntax
    js_lines = ["const hardcodedQuestions = ["]
    for q in questions:
        # json.dumps safely escapes double quotes, backslashes, and line breaks
        js_lines.append(f"  {json.dumps(q)},")
    js_lines.append("];\n")

    output_content = "\n".join(js_lines)

    with open(output_file_path, mode="w", encoding="utf-8") as f:
        f.write(output_content)

    print(f"Successfully extracted {len(questions)} questions from '{csv_file_path}' to '{output_file_path}'.")

def main():
    parser = argparse.ArgumentParser(
        description="Extract a question column from a CSV file and output as a JavaScript const array."
    )
    parser.add_argument(
        "-i", "--input",
        dest="csv_file",
        default="Spark KB - TENS.csv",
        help="Path to the input CSV file (default: 'Spark KB - TENS.csv')"
    )
    parser.add_argument(
        "-o", "--output",
        dest="output_file",
        default="hardcodedQuestions.js",
        help="Path to the output JS/txt file (default: 'hardcodedQuestions.js')"
    )
    parser.add_argument(
        "-c", "--column",
        dest="column_name",
        default="Question",
        help="Name of the column containing questions (case-insensitive, default: 'question')"
    )
    parser.add_argument(
        "--no-dedup",
        dest="dedup",
        action="store_false",
        help="Do not deduplicate questions (preserves duplicates)"
    )

    args = parser.parse_args()
    extract_questions_to_js(
        csv_file_path=args.csv_file,
        output_file_path=args.output_file,
        target_column=args.column_name,
        deduplicate=args.dedup
    )

if __name__ == "__main__":
    main()
