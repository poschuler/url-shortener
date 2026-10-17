#!/usr/bin/env bash

# Exports the C4 diagrams of docs/architecture.md to SVG, in a light and a
# dark variant with the background embedded. The Mermaid blocks in that file
# are the only source: each one is found by the heading of its level.

set -euo pipefail

SOURCE="docs/architecture.md"
OUT="architecture/diagrams"

# "<file name>|<heading>", one per diagram.
DIAGRAMS=(
	"context|## Level 1: Context"
	"containers|## Level 2: Containers"
	"links-components|## Level 3: Components of the \`links\` module"
)

if [[ ! -f "${SOURCE}" ]]; then
	echo "error: run this from the repository root ('pnpm run diagrams')." >&2
	exit 1
fi

STAGED="$(mktemp -d)"
trap 'rm -rf "${STAGED}"' EXIT

# Prints the first mermaid block after the heading, before the next "## ".
extract() {
	awk -v heading="$1" '
		$0 == heading { inside = 1; next }
		inside && /^## / { exit }
		inside && !block && $0 == "```mermaid" { block = 1; next }
		block && $0 == "```" { exit }
		block { print }
	' "${SOURCE}"
}

for DIAGRAM in "${DIAGRAMS[@]}"; do
	NAME="${DIAGRAM%%|*}"
	HEADING="${DIAGRAM#*|}"
	extract "${HEADING}" >"${STAGED}/${NAME}.mmd"
	if [[ ! -s "${STAGED}/${NAME}.mmd" ]]; then
		echo "error: no mermaid block under '${HEADING}' in ${SOURCE}." >&2
		exit 1
	fi
done

mkdir -p "${OUT}/light" "${OUT}/dark"

echo "==> Emptying ${OUT}"
rm -f "${OUT}"/light/*.svg "${OUT}"/dark/*.svg

for MODE in light dark; do
	if [[ "${MODE}" == light ]]; then
		THEME="default"
		BACKGROUND="#ffffff"
	else
		THEME="dark"
		BACKGROUND="#111111"
	fi

	echo "==> Exporting every diagram, ${MODE}"
	for DIAGRAM in "${DIAGRAMS[@]}"; do
		NAME="${DIAGRAM%%|*}"
		mmdc --quiet \
			-i "${STAGED}/${NAME}.mmd" \
			-o "${OUT}/${MODE}/${NAME}.svg" \
			-t "${THEME}" \
			-b "${BACKGROUND}"
	done
done

echo
echo "==> $(ls "${OUT}"/light/*.svg "${OUT}"/dark/*.svg | wc -l) files in ${OUT}"
echo "==> These are committed and nothing checks them; commit what changed."
