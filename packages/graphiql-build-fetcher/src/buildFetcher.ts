import type { Fetcher } from '@graphiql/toolkit';
import type { BuildFetcherOptions } from './types';

import {
  createMultipartFetcher,
  createSimpleFetcher,
  isSubcriptionWithName,
  createWebsocketsFetcherFromUrl,
  createWebsocketsFetcherFromClient,
} from './lib';

/**
 * build a GraphiQL fetcher that is:
 * - backwards compatible
 * - optionally supports graphql-ws or `
 *
 * @param options {BuildFetcherOptions}
 * @returns {Fetcher}
 */
export function buildGraphiQLFetcher(options: BuildFetcherOptions): Fetcher {
  let httpFetch;
  let wsFetcher: null | Fetcher | void = null;
  if (typeof window !== null && window?.fetch) {
    httpFetch = window.fetch;
  }
  if (
    options?.enableIncrementalDelivery === null ||
    options.enableIncrementalDelivery !== false
  ) {
    options.enableIncrementalDelivery = true;
  }
  if (options.fetch) {
    httpFetch = options.fetch;
  }
  if (!httpFetch) {
    throw Error('No valid fetcher implementation available');
  }

  const simpleFetcher = createSimpleFetcher(options, httpFetch);

  if (options.subscriptionUrl) {
    wsFetcher = createWebsocketsFetcherFromUrl(options.subscriptionUrl);
  }
  if (options.wsClient) {
    wsFetcher = createWebsocketsFetcherFromClient(options.wsClient);
  }

  const httpFetcher = options.enableIncrementalDelivery
    ? createMultipartFetcher(options)
    : simpleFetcher;

  return (graphQLParams, opts) => {
    if (graphQLParams.operationName === 'IntrospectionQuery') {
      return simpleFetcher(graphQLParams, opts);
    }
    const isSubscription = isSubcriptionWithName(
      opts?.documentAST!,
      graphQLParams.operationName,
    );
    if (isSubscription) {
      if (!wsFetcher) {
        throw Error(
          `Your GraphiQL buildFetcher is not properly configured for websocket subscriptions yet. ${
            options.subscriptionUrl
              ? `Provided URL ${options.subscriptionUrl} failed`
              : `Try providing options.subscriptionUrl or options.wsClient first.`
          }`,
        );
      }
      return wsFetcher(graphQLParams);
    }
    return httpFetcher(graphQLParams, opts);
  };
}
