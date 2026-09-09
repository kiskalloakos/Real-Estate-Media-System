import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/native/brand-text';
import { nativeColors } from '@/components/native/native-colors';

import {
  parseDocumentContent,
  type DocumentContentBlock,
} from './document-utils';

export interface DocumentContentProps {
  content?: string;
}

export function DocumentContent({ content }: DocumentContentProps) {
  const blocks = parseDocumentContent(content);

  return (
    <View style={styles.content}>
      {blocks.map((block, blockIndex) => (
        <Text
          key={`${block.kind}-${blockIndex}`}
          selectable
          style={blockStyle(block)}
        >
          {block.runs.map((run, runIndex) => (
            <Text
              key={`${blockIndex}-${runIndex}`}
              style={[run.bold && styles.bold, run.underline && styles.underline]}
            >
              {run.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

function blockStyle(block: DocumentContentBlock) {
  return block.kind === 'heading' ? styles.heading : styles.paragraph;
}

const styles = StyleSheet.create({
  bold: {
    fontFamily: 'OutfitSemiBold',
    fontWeight: '600',
  },
  content: {
    gap: 14,
  },
  heading: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.25,
    lineHeight: 28,
  },
  paragraph: {
    color: nativeColors.label,
    fontFamily: 'OutfitRegular',
    fontSize: 16,
    lineHeight: 25,
  },
  underline: {
    textDecorationLine: 'underline',
  },
});
