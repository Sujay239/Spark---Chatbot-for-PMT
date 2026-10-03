import re
import json
import argparse
import os

def parse_questions_from_js(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Match string literals within array: "..." or '...'
    # Handles escaped quotes inside the strings
    pattern = r'(?:"((?:\\.|[^"\\])*)"|\'((?:\\.|[^\'\\])*)\')'
    matches = re.findall(pattern, content)

    questions = []
    for m in matches:
        q = m[0] if m[0] else m[1]
        # unescape characters like \", \', \\
        q_unescaped = bytes(q, "utf-8").decode("unicode_escape", errors="ignore")
        questions.append(q_unescaped.strip())
    return questions

def filter_new_questions(
    prev_file="hardcoded_prev.js",
    current_file="hardcodedQuestions.js",
    output_file="new_questions.js",
    case_sensitive=True
):
    prev_questions = parse_questions_from_js(prev_file)
    curr_questions = parse_questions_from_js(current_file)

    if case_sensitive:
        prev_set = {q.strip() for q in prev_questions}
        new_questions = [q for q in curr_questions if q.strip() not in prev_set]
    else:
        prev_set = {q.strip().lower() for q in prev_questions}
        new_questions = [q for q in curr_questions if q.strip().lower() not in prev_set]

    # Deduplicate while preserving order
    seen = set()
    deduped_new = []
    for q in new_questions:
        key = q if case_sensitive else q.lower()
        if key not in seen:
            seen.add(key)
            deduped_new.append(q)

    # Format into JavaScript array syntax
    js_lines = ["const hardcodedQuestions = ["]
    for q in deduped_new:
        js_lines.append(f"  {json.dumps(q)},")
    js_lines.append("];\n")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(js_lines))

    print(f"Total in prev ('{prev_file}'): {len(prev_questions)}")
    print(f"Total in current ('{current_file}'): {len(curr_questions)}")
    print(f"New filtered questions saved to '{output_file}': {len(deduped_new)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Filter questions present in current file but missing in previous file."
    )
    parser.add_argument(
        "--prev", "-p",
        default="hardcoded_prev.js",
        help="Path to previous JS file (default: hardcoded_prev.js)"
    )
    parser.add_argument(
        "--curr", "-c",
        default="hardcodedQuestions.js",
        help="Path to current JS file (default: hardcodedQuestions.js)"
    )
    parser.add_argument(
        "--out", "-o",
        default="new_questions.js",
        help="Path to output JS file (default: new_questions.js)"
    )
    parser.add_argument(
        "--ignore-case",
        action="store_true",
        help="Case-insensitive comparison"
    )

    args = parser.parse_args()
    filter_new_questions(
        prev_file=args.prev,
        current_file=args.curr,
        output_file=args.out,
        case_sensitive=not args.ignore_case
    )
