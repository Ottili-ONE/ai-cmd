import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import * as anthropicModule from '../../src/providers/anthropic'
import * as googleModule from '../../src/providers/google'
import * as ollamaModule from '../../src/providers/ollama'
import * as openaiModule from '../../src/providers/openai'
import { ProviderError } from '../../src/utils/errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = originalFetch
})

describe('providers error and timeout behavior', () => {
  it('should throw ProviderError on non-OK HTTP with error payload for each provider', async () => {
    // prepare a non-OK response with JSON error payload
    const badResponse = {
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad stuff' }),
      text: async () => 'bad stuff'
    } as any

    globalThis.fetch = vi.fn().mockResolvedValue(badResponse)

    const config = {
      baseUrl: 'https://api.test',
      apiKey: 'key',
      model: 'm1',
      timeoutMs: 1_000,
      provider: 'openai',
      analytics: false
    } as any

    const anth = new anthropicModule.AnthropicProvider(config)
    const goog = new googleModule.GoogleProvider(config)
    const oll = new ollamaModule.OllamaProvider(config)
    const oa = new openaiModule.OpenAICompatibleProvider('openai', config)

    const request = {
      systemPrompt: 's',
      userPrompt: 'u',
      schemaName: 'n',
      schemaDescription: 'd',
      jsonSchema: {}
    } as any

    await Promise.all([
      expect(anth.generateObject(request)).rejects.toBeInstanceOf(ProviderError),
      expect(goog.generateObject(request)).rejects.toBeInstanceOf(ProviderError),
      expect(oll.generateObject(request)).rejects.toBeInstanceOf(ProviderError),
      expect(oa.generateObject(request)).rejects.toBeInstanceOf(ProviderError)
    ])
  })

  it('should surface AbortError / timeout as ProviderError for each provider', async () => {
    const abortErr = new Error('The operation was aborted')
    ;(abortErr as any).name = 'AbortError'

    globalThis.fetch = vi.fn().mockImplementation(() => {
      throw abortErr
    })

    const config = {
      baseUrl: 'https://api.test',
      apiKey: 'key',
      model: 'm1',
      timeoutMs: 1_000,
      provider: 'openai',
      analytics: false
    } as any

    const anth = new anthropicModule.AnthropicProvider(config)
    const goog = new googleModule.GoogleProvider(config)
    const oll = new ollamaModule.OllamaProvider(config)
    const oa = new openaiModule.OpenAICompatibleProvider('openai', config)

    const request = {
      systemPrompt: 's',
      userPrompt: 'u',
      schemaName: 'n',
      schemaDescription: 'd',
      jsonSchema: {}
    } as any

    await Promise.all([
      expect(anth.generateObject(request)).rejects.toBeInstanceOf(ProviderError),
      expect(goog.generateObject(request)).rejects.toBeInstanceOf(ProviderError),
      expect(oll.generateObject(request)).rejects.toBeInstanceOf(ProviderError),
      expect(oa.generateObject(request)).rejects.toBeInstanceOf(ProviderError)
    ])
  })
})
