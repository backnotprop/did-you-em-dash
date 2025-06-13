# Did You Em Dash?

[![didyouemdash.com](https://img.shields.io/badge/didyouemdash.com-Try%20the%20Tool-blue?style=for-the-badge)](https://didyouemdash.com)

**Prove you used em dashes before ChatGPT with this Hacker News submission analyzer.**

A tool to search your pre-2022 Hacker News submissions for em dash usage patterns.

## Overview

Some social media users claim that frequent em dash usage indicates AI-generated text. This tool searches your Hacker News submissions from before November 30, 2022 to demonstrate your pre-ChatGPT writing patterns.

The application analyzes your public Hacker News comments and story titles for em dash patterns, providing evidence of your authentic writing style before widespread AI adoption.

## How It Works

1. Enter your Hacker News username
2. Choose search settings (strict em dash matching, include story titles)
3. The tool searches your submissions chronologically from oldest to newest
4. Results show the first instance of em dash usage with a link to the original post

### Search Modes

**Loose Mode**: Matches various dash types including `--`, `––`, `——`, `–`, and `—`

**Strict Mode**: Only matches true em dashes (`—`)

**Content Types**: Search comments only (default) or include story titles

## URL Parameters

Share your results with query parameters:

- `?username=yourname` - Auto-populate username field
- `?strict=true` - Enable strict em dash mode
- `?username=pg&strict=true` - Combined parameters
