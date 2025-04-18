# Suppress DidYouMean deprecation warnings
if defined?(DidYouMean::SPELL_CHECKERS)
  DidYouMean.correct_error(error_name, spell_checker) if respond_to?(:correct_error)
end

# Set up gems listed in the Gemfile.
ENV['BUNDLE_GEMFILE'] ||= File.expand_path('../../Gemfile', __FILE__)

require 'bundler/setup' if File.exist?(ENV['BUNDLE_GEMFILE'])
require 'matrix'
