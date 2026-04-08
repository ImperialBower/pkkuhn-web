.PHONY: build serve clean build-release install-playwright test test-ui

# Build the WASM module into www/pkg (requires wasm-pack)
build:
	wasm-pack build --target web --out-dir www/pkg

# Build and serve locally on port 8080
serve: build
	@echo "Serving at http://localhost:8080"
	cd www && python3 -m http.server 8080

# Build an optimised release WASM
build-release:
	wasm-pack build --release --target web --out-dir www/pkg

clean:
	cargo clean
	rm -rf www/pkg

# Install Node dependencies and Playwright browsers (run once after cloning).
install-playwright:
	npm install
	npx playwright install chromium

# Run the full Playwright suite headlessly (also builds WASM first).
test: build
	npx playwright test

# Open the Playwright interactive UI runner (local development only).
test-ui: build
	npx playwright test --ui
